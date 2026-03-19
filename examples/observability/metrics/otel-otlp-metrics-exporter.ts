/**
 * OpenTelemetry Metrics with Prometheus UI Example (TypeScript)
 *
 * This example demonstrates how to use OpenTelemetry metrics with the Couchbase Node.js SDK
 * and export metrics to Prometheus for visualization in a web UI.
 *
 * What this example does:
 * - Sets up OpenTelemetry metrics with OTLP exporter for Prometheus
 * - Creates a Couchbase cluster connection with OTel tracing enabled
 * - Performs various KV and query operations
 * - Exports all metrics to Prometheus for visualization in the UI
 *
 * Prerequisites:
 * - Prometheus and OTel Collector running locally
 * - Couchbase Server running
 * - OpenTelemetry packages installed
 *
 * Installation:
 *   npm install:
 *       - @opentelemetry/api (^1.9.0)
 *       - @opentelemetry/sdk-node (^0.213.0)
 *       - @opentelemetry/sdk-metrics-node (^2.6.0)
 *       - @opentelemetry/exporter-metrics-otlp-grpc (^0.213.0)
 *
 * Quick Start with Docker:
 *   # Start containers
 *   docker-compose up -d
 *
 *   # Run this example
 *   tsx otel-otlp-metrics-exporter.ts
 *
 *   # Open Prometheus UI in browser
 *   # http://localhost:9090
 *
 * Expected output:
 * - Console logs showing operations being performed
 * - Metrics should visible in Prometheus UI at http://localhost:9090
 * - Search "db_client_operation_duration_seconds_bucket" in UI
 */

import {
  defaultResource,
  resourceFromAttributes,
} from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc'
import { connect, getOTelMeter } from 'couchbase'

// Configuration
const SERVICE_NAME = 'couchbase-otel-metrics-example'
const METRICS_ENDPOINT = 'http://localhost:4317'
const CONNECTION_STRING = 'couchbase://localhost'
const BUCKET_NAME = 'default'
const USERNAME = 'Administrator'
const PASSWORD = 'password'

function setupOtelMetrics(): MeterProvider {
  const customResource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: SERVICE_NAME,
  })
  const resource = defaultResource().merge(customResource)

  const metricExporter = new OTLPMetricExporter({
    url: METRICS_ENDPOINT,
  })

  const meterProvider = new MeterProvider({
    resource: resource,
    readers: [
      new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: 1000, // Export metrics every 1 second
      }),
    ],
  })

  return meterProvider
}

function printBanner(): void {
  console.log('\n' + '='.repeat(80))
  console.log('OpenTelemetry OTLP Metrics Export Example (Prometheus)')
  console.log('='.repeat(80) + '\n')
}

async function performOperations(collection: any, cluster: any): Promise<void> {
  console.log('\n' + '-'.repeat(80))
  console.log('Performing Operations (Generating Metrics)')
  console.log('-'.repeat(80) + '\n')

  const docs: Record<string, any> = {
    'metrics:1': { name: 'Alice', age: 30, type: 'user', user_role: 'admin' },
    'metrics:2': { name: 'Bob', age: 25, type: 'user', user_role: 'developer' },
    'metrics:3': {
      name: 'Charlie',
      age: 35,
      type: 'user',
      user_role: 'manager',
    },
    'metrics:4': {
      name: 'Diana',
      age: 28,
      type: 'user',
      user_role: 'designer',
    },
    'metrics:5': { name: 'Eve', age: 32, type: 'user', user_role: 'analyst' },
  }

  const docKeys = Object.keys(docs)

  console.log('1. Upserting documents...')
  for (const key of docKeys) {
    await collection.upsert(key, docs[key])
    console.log(`   ✓ Upserted '${key}'`)
  }

  console.log(
    '\n2. Retrieving documents (multiple rounds for histogram data)...'
  )
  for (let roundNum = 1; roundNum <= 3; roundNum++) {
    console.log(`   Round ${roundNum}:`)
    for (const key of docKeys) {
      await collection.get(key)
    }
    console.log(`     ✓ Retrieved all ${docKeys.length} documents`)
  }

  console.log('\n3. Replacing documents...')
  for (const key of docKeys.slice(0, 3)) {
    // Just first 3
    const getResult = await collection.get(key)
    const doc = getResult.content
    doc.updated = true
    await collection.replace(key, doc, { cas: getResult.cas })
    console.log(`   ✓ Replaced '${key}'`)
  }

  console.log('\n4. Touching documents (updating expiry)...')
  for (const key of docKeys.slice(3)) {
    // Last 2
    await collection.touch(key, 3600) // Expiry in milliseconds
    console.log(`   ✓ Touched '${key}'`)
  }

  console.log('\n5. Executing N1QL query...')
  const query = `SELECT name, user_role FROM \`${BUCKET_NAME}\` WHERE type = 'user' LIMIT 3`
  try {
    const result = await cluster.query(query)
    console.log(`   ✓ Query returned ${result.rows.length} rows`)
  } catch (e: any) {
    console.log(`   ⚠ Query failed: ${e.message}`)
  }

  console.log('\n6. Cleaning up...')
  for (const key of docKeys) {
    try {
      await collection.remove(key)
      console.log(`   ✓ Removed '${key}'`)
    } catch (e) {
      // Ignore not found errors during cleanup
    }
  }

  console.log('\n' + '-'.repeat(80))
  console.log('All operations completed!')
  console.log('-'.repeat(80))
}

async function main(): Promise<void> {
  printBanner()
  let meterProvider: MeterProvider | null = null

  try {
    console.log('Setting up OpenTelemetry Metrics...')
    meterProvider = setupOtelMetrics()
    console.log('✓ OpenTelemetry Metrics configured\n')

    console.log(`Connecting to Couchbase at ${CONNECTION_STRING}...`)

    // Wrap the OTel meter with the Couchbase SDK wrapper
    const couchbaseMeter = getOTelMeter(meterProvider)

    const cluster = await connect(CONNECTION_STRING, {
      username: USERNAME,
      password: PASSWORD,
      meter: couchbaseMeter, // Inject the metrics wrapper here!
    })

    const bucket = cluster.bucket(BUCKET_NAME)
    const collection = bucket.defaultCollection()
    console.log('✓ Connected to Couchbase\n')

    await performOperations(collection, cluster)

    console.log('\nClosing cluster connection...')
    await cluster.close()

    // Give the periodic reader a moment to catch the final operations
    console.log('Flushing final metrics to OTLP Collector...')
    await new Promise((resolve) => setTimeout(resolve, 2000))
  } catch (e) {
    console.error(`\nERROR:`, e)
  } finally {
    // CRITICAL: Force the final batch of metrics to be exported
    if (meterProvider) {
      await meterProvider.shutdown()
      console.log('✓ OpenTelemetry provider shut down gracefully.')

      console.log('\n' + '='.repeat(80))
      console.log('SUCCESS! Metrics Exported')
      console.log('='.repeat(80))
      console.log('\n📊 VIEW METRICS IN PROMETHEUS:')
      console.log('  • Prometheus UI: http://localhost:9090')
      console.log(
        '  • Search for: db_client_operation_duration_seconds_bucket (or similar depending on OTel translation)'
      )
      console.log('='.repeat(80) + '\n')
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
