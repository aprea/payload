import type { DbType, StorageAdapterType } from '../types.js'

type DbAdapterReplacement = {
  configReplacement: string[]
  importReplacement: string
  packageName: string
}

const mongodbReplacement: DbAdapterReplacement = {
  // Replacement between `// database-adapter-config-start` and `// database-adapter-config-end`
  configReplacement: [
    '  db: mongooseAdapter({',
    "    url: process.env.DATABASE_URI || '',",
    '  }),',
  ],
  importReplacement: "import { mongooseAdapter } from '@payloadcms/db-mongodb'",
  packageName: '@payloadcms/db-mongodb',
}

const postgresReplacement: DbAdapterReplacement = {
  configReplacement: [
    '  db: postgresAdapter({',
    '    pool: {',
    "      connectionString: process.env.DATABASE_URI || '',",
    '    },',
    '  }),',
  ],
  importReplacement: "import { postgresAdapter } from '@payloadcms/db-postgres'",
  packageName: '@payloadcms/db-postgres',
}

export const dbReplacements: Record<DbType, DbAdapterReplacement> = {
  mongodb: mongodbReplacement,
  postgres: postgresReplacement,
}

type StorageAdapterReplacement = {
  configReplacement: string[]
  importReplacement: string
  packageName: string
}

const vercelBlobStorageReplacement: StorageAdapterReplacement = {
  // Replacement of `// storage-adapter-placeholder`
  configReplacement: [
    '    vercelBlobStorage({',
    '      collections: {',
    '        [Media.slug]: true,',
    '      },',
    "      token: process.env.BLOB_READ_WRITE_TOKEN || '',",
    '    }),',
  ],
  importReplacement: "import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'",
  packageName: '@payloadcms/storage-vercel-blob',
}

const payloadCloudReplacement: StorageAdapterReplacement = {
  configReplacement: ['    payloadCloudPlugin(),'],
  importReplacement: "import { payloadCloudPlugin } from '@payloadcms/plugin-cloud'",
  packageName: '@payloadcms/plugin-cloud',
}

export const storageReplacements: Record<StorageAdapterType, StorageAdapterReplacement> = {
  payloadCloud: payloadCloudReplacement,
  vercelBlobStorage: vercelBlobStorageReplacement,
}
