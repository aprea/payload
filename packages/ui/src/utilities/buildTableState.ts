import type { I18nClient } from '@payloadcms/translations'
import type {
  BuildTableStateArgs,
  ClientCollectionConfig,
  ClientConfig,
  ErrorResult,
  SanitizedCollectionConfig,
  SanitizedConfig,
} from 'payload'

import { createClientConfig, formatErrors } from 'payload'

import type { Column } from '../elements/Table/index.js'

import { renderFilters, renderTable } from './renderTable.js'

let cachedClientConfig = global._payload_clientConfig

if (!cachedClientConfig) {
  cachedClientConfig = global._payload_clientConfig = null
}

export const getClientConfig = (args: {
  config: SanitizedConfig
  i18n: I18nClient
}): ClientConfig => {
  const { config, i18n } = args

  if (cachedClientConfig && process.env.NODE_ENV !== 'development') {
    return cachedClientConfig
  }

  cachedClientConfig = createClientConfig({
    config,
    i18n,
  })

  return cachedClientConfig
}

type BuildTableStateSuccessResult = {
  clientConfig?: ClientConfig
  errors?: never
  renderedFilters: Map<string, React.ReactNode>
  state: Column[]
  Table: React.ReactNode
}

type BuildTableStateErrorResult = {
  renderedFilters?: never
  state?: never
  Table?: never
} & (
  | {
      message: string
    }
  | ErrorResult
)

export type BuildTableStateResult = BuildTableStateErrorResult | BuildTableStateSuccessResult

export const buildTableState = async (
  args: BuildTableStateArgs,
): Promise<BuildTableStateResult> => {
  const { req } = args

  try {
    const res = await buildTableStateFn(args)
    return res
  } catch (err) {
    req.payload.logger.error({ err, msg: `There was an error building form state` })

    if (err.message === 'Could not find field schema for given path') {
      return {
        message: err.message,
      }
    }

    if (err.message === 'Unauthorized') {
      return null
    }

    return formatErrors(err)
  }
}

export const buildTableStateFn = async (
  args: BuildTableStateArgs,
): Promise<BuildTableStateSuccessResult> => {
  const {
    collectionSlug,
    columns,
    docs: docsFromArgs,
    req,
    req: {
      i18n,
      payload,
      payload: { config },
      user,
    },
  } = args

  const incomingUserSlug = user?.collection

  const adminUserSlug = config.admin.user

  // If we have a user slug, test it against the functions
  if (incomingUserSlug) {
    const adminAccessFunction = payload.collections[incomingUserSlug].config.access?.admin

    // Run the admin access function from the config if it exists
    if (adminAccessFunction) {
      const canAccessAdmin = await adminAccessFunction({ req })

      if (!canAccessAdmin) {
        throw new Error('Unauthorized')
      }
      // Match the user collection to the global admin config
    } else if (adminUserSlug !== incomingUserSlug) {
      throw new Error('Unauthorized')
    }
  } else {
    const hasUsers = await payload.find({
      collection: adminUserSlug,
      depth: 0,
      limit: 1,
      pagination: false,
    })

    // If there are users, we should not allow access because of /create-first-user
    if (hasUsers.docs.length) {
      throw new Error('Unauthorized')
    }
  }

  const clientConfig = getClientConfig({
    config,
    i18n,
  })

  let collectionConfig: SanitizedCollectionConfig
  let clientCollectionConfig: ClientCollectionConfig

  if (req.payload.collections[collectionSlug]) {
    collectionConfig = req.payload.collections[collectionSlug].config
    clientCollectionConfig = clientConfig.collections.find(
      (collection) => collection.slug === collectionSlug,
    )
  }

  const fields = collectionConfig.fields
  const clientFields = clientCollectionConfig?.fields || []

  let docs = docsFromArgs

  if (!docs) {
    docs = await payload
      .find({
        collection: collectionSlug,
        depth: 0,
        limit: 100,
        pagination: false,
        // where: {} TODO: pass where through args
      })
      ?.then((res) => res.docs)
  }

  const { columnState, Table } = renderTable({
    clientFields,
    collectionSlug,
    columnPreferences: undefined, // TODO, might not be needed
    columns,
    docs,
    enableRowSelections: true,
    fields,
    importMap: payload.importMap,
    useAsTitle: collectionConfig.admin.useAsTitle,
  })

  const renderedFilters = renderFilters(fields)

  return {
    renderedFilters,
    state: columnState,
    Table,
  }
}
