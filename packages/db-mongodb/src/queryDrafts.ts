import type { PaginateOptions } from 'mongoose'
import type { PayloadRequest, QueryDrafts } from 'payload'

import { buildVersionCollectionFields, combineQueries, flattenWhereToOperators } from 'payload'

import type { MongooseAdapter } from './index.js'

import { getSession } from './getSession.js'
import { buildSortParam } from './queries/buildSortParam.js'
import { buildJoinAggregation } from './utilities/buildJoinAggregation.js'
import { buildProjectionFromSelect } from './utilities/buildProjectionFromSelect.js'
import { transform } from './utilities/transform.js'

export const queryDrafts: QueryDrafts = async function queryDrafts(
  this: MongooseAdapter,
  {
    collection,
    joins,
    limit,
    locale,
    page,
    pagination,
    req = {} as PayloadRequest,
    select,
    sort: sortArg,
    where,
  },
) {
  const VersionModel = this.versions[collection]
  const collectionConfig = this.payload.collections[collection].config
  const session = await getSession(this, req)

  let hasNearConstraint
  let sort

  if (where) {
    const constraints = flattenWhereToOperators(where)
    hasNearConstraint = constraints.some((prop) => Object.keys(prop).some((key) => key === 'near'))
  }

  if (!hasNearConstraint) {
    sort = buildSortParam({
      config: this.payload.config,
      fields: collectionConfig.fields,
      locale,
      sort: sortArg || collectionConfig.defaultSort,
      timestamps: true,
    })
  }

  const combinedWhere = combineQueries({ latest: { equals: true } }, where)

  const versionQuery = await VersionModel.buildQuery({
    locale,
    payload: this.payload,
    where: combinedWhere,
  })

  const versionFields = buildVersionCollectionFields(this.payload.config, collectionConfig)
  const projection = buildProjectionFromSelect({
    adapter: this,
    fields: versionFields,
    select,
  })
  // useEstimatedCount is faster, but not accurate, as it ignores any filters. It is thus set to true if there are no filters.
  const useEstimatedCount =
    hasNearConstraint || !versionQuery || Object.keys(versionQuery).length === 0
  const paginationOptions: PaginateOptions = {
    lean: true,
    leanWithId: true,
    options: { session },
    page,
    pagination,
    projection,
    sort,
    useEstimatedCount,
  }

  if (this.collation) {
    const defaultLocale = 'en'
    paginationOptions.collation = {
      locale: locale && locale !== 'all' && locale !== '*' ? locale : defaultLocale,
      ...this.collation,
    }
  }

  if (
    !useEstimatedCount &&
    Object.keys(versionQuery).length === 0 &&
    this.disableIndexHints !== true
  ) {
    // Improve the performance of the countDocuments query which is used if useEstimatedCount is set to false by adding
    // a hint. By default, if no hint is provided, MongoDB does not use an indexed field to count the returned documents,
    // which makes queries very slow. This only happens when no query (filter) is provided. If one is provided, it uses
    // the correct indexed field
    paginationOptions.useCustomCountFn = () => {
      return Promise.resolve(
        VersionModel.countDocuments(versionQuery, {
          hint: { _id: 1 },
        }),
      )
    }
  }

  if (limit > 0) {
    paginationOptions.limit = limit
    // limit must also be set here, it's ignored when pagination is false
    paginationOptions.options.limit = limit
  }

  let result

  const aggregate = await buildJoinAggregation({
    adapter: this,
    collection,
    collectionConfig,
    joins,
    locale,
    projection,
    query: versionQuery,
    versions: true,
  })

  // build join aggregation
  if (aggregate) {
    result = await VersionModel.aggregatePaginate(
      VersionModel.aggregate(aggregate),
      paginationOptions,
    )
  } else {
    result = await VersionModel.paginate(versionQuery, paginationOptions)
  }

  transform({
    type: 'read',
    adapter: this,
    data: result.docs,
    fields: versionFields,
  })

  for (let i = 0; i < result.docs.length; i++) {
    const id = result.docs[i].parent
    result.docs[i] = result.docs[i].version
    result.docs[i].id = id
  }

  return result
}
