import {
  BaseClientOptions,
  buildClient,
  SchemaInference,
  XataRecord,
} from '@xata.io/client'

const tables = [
  {
    name: 'remix_with_xata_example',
    columns: [
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'url', type: 'string' },
    ],
  },
] as const

export type SchemaTables = typeof tables
export type DatabaseSchema = SchemaInference<SchemaTables>

export type RemixWithXataExample = DatabaseSchema['remix_with_xata_example']
export type RemixWithXataExampleRecord = RemixWithXataExample & XataRecord

const DatabaseClient = buildClient()

const defaultOptions = {
  databaseURL: 'https://xata_examples-hf8grf.xata.sh/db/remix_minimal',
}

export class XataClient extends DatabaseClient<SchemaTables> {
  constructor(options?: BaseClientOptions) {
    super({ ...defaultOptions, ...options }, tables)
  }
}

let instance: XataClient | undefined = undefined
export const getXataClient = () => {
  if (instance) return instance

  instance = new XataClient()
  return instance
}
