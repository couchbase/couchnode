import {
  defaultResource,
  resourceFromAttributes,
} from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'
import {
  AlwaysOnSampler,
  ConsoleSpanExporter,
  NodeTracerProvider,
  ParentBasedSampler,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-node'
import {
  connect,
  getOTelTracer,
  createConsoleLogger,
  LogLevel,
} from 'couchbase'

// Configuration
const SERVICE_NAME = 'couchbase-otel-tracing-example'
const CONNECTION_STRING = 'couchbase://localhost'
const BUCKET_NAME = 'default'
const USERNAME = 'Administrator'
const PASSWORD = 'password'

function setupOtelConsoleExporter(): NodeTracerProvider {
  const customResource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: SERVICE_NAME,
  })
  const resource = defaultResource().merge(customResource)

  const consoleExporter = new ConsoleSpanExporter()
  const processor = new SimpleSpanProcessor(consoleExporter)

  const sampler = new ParentBasedSampler({
    root: new AlwaysOnSampler(),
  })

  const provider = new NodeTracerProvider({
    resource: resource,
    sampler: sampler,
    spanProcessors: [processor],
  })

  provider.register()

  return provider
}

async function main() {
  const tracerProvider = setupOtelConsoleExporter()

  // 1. Create a unified console logger for the app and the SDK
  const logger = createConsoleLogger(LogLevel.DEBUG)

  logger.info('Starting OpenTelemetry Tracing & SDK Logging Console Example')
  logger.info(`Connecting to ${CONNECTION_STRING}...`)

  try {
    const couchbaseTracer = getOTelTracer(tracerProvider)

    const cluster = await connect(CONNECTION_STRING, {
      username: USERNAME,
      password: PASSWORD,
      tracer: couchbaseTracer,
      logger: logger,
    })

    const bucket = cluster.bucket(BUCKET_NAME)
    const collection = bucket.defaultCollection()

    logger.info('Connected successfully! Performing operations...')

    const testDocument = {
      id: 1,
      name: 'OpenTelemetry Demo',
      description: 'Testing Couchbase with OpenTelemetry tracing',
      timestamp: Date.now(),
    }
    const testKey = 'otelDemoKey'

    logger.info(`Upserting document '${testKey}'...`)
    const upResult = await collection.upsert(testKey, testDocument)
    logger.debug(`Upsert CAS: ${upResult.cas}`) // Using debug for raw data!

    logger.info(`Retrieving document '${testKey}'...`)
    let getResult = await collection.get(testKey)
    logger.debug(`Retrieved name: ${getResult.content.name}`)

    logger.info(`Replacing document '${testKey}'...`)
    testDocument.description = 'Updated: Testing Couchbase with OpenTelemetry'
    const replaceResult = await collection.replace(testKey, testDocument, {
      cas: upResult.cas,
    })
    logger.debug(`Replace CAS: ${replaceResult.cas}`)

    logger.info(`Executing N1QL query...`)
    const query = `SELECT name, description FROM \`${BUCKET_NAME}\` USE KEYS '${testKey}'`
    try {
      const queryResult = await cluster.query(query)
      logger.info(`   Query returned ${queryResult.rows.length} rows`)
      for (const row of queryResult.rows) {
        logger.debug(`      - ${row.name}: ${row.description}`)
      }
    } catch (e: any) {
      logger.warn(`Query failed: ${e.message}`) // Graceful warning
    }

    logger.info(`Removing document '${testKey}'...`)
    const removeResult = await collection.remove(testKey)
    logger.debug(`Remove CAS: ${removeResult.cas}`)

    logger.info('All operations completed! Closing connection...')
    await cluster.close()
  } catch (e: any) {
    logger.error(`Fatal ERROR: ${e.message}`)
  } finally {
    if (tracerProvider) {
      await tracerProvider.shutdown()
      logger.info('OpenTelemetry tracer shut down gracefully.')
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
