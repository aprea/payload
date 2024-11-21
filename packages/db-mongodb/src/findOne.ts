import type { FindOne, PayloadRequest } from 'payload'

import type { MongooseAdapter } from './index.js'

import { getSession } from './getSession.js'
import { buildJoinAggregation } from './utilities/buildJoinAggregation.js'
import { buildProjectionFromSelect } from './utilities/buildProjectionFromSelect.js'
import { transform } from './utilities/transform.js'

export const findOne: FindOne = async function findOne(
  this: MongooseAdapter,
  { collection, joins, locale, req = {} as PayloadRequest, select, where },
) {
  const Model = this.collections[collection]
  const collectionConfig = this.payload.collections[collection].config

  const session = await getSession(this, req)

  const query = await Model.buildQuery({
    locale,
    payload: this.payload,
    where,
  })

  const fields = collectionConfig.fields

  const projection = buildProjectionFromSelect({
    adapter: this,
    fields,
    select,
  })

  const aggregate = await buildJoinAggregation({
    adapter: this,
    collection,
    collectionConfig,
    joins,
    limit: 1,
    locale,
    projection,
    query,
  })

  let doc
  if (aggregate) {
    ;[doc] = await Model.collection.aggregate(aggregate, { session }).toArray()
  } else {
    doc = await Model.collection.findOne(query, { projection, session })
  }

  if (!doc) {
    return null
  }

  transform({
    type: 'read',
    adapter: this,
    data: doc,
    fields,
  })

  return doc
}
