/**
 * OpenTelemetry Tracing with Jaeger UI Example (TypeScript)
 *
 * This example demonstrates how to use OpenTelemetry tracing with the Couchbase Node.js SDK
 * and export traces to Jaeger for visualization in a web UI.
 *
 * What this example does:
 * - Sets up OpenTelemetry tracing with OTLP exporter for Jaeger
 * - Creates a Couchbase cluster connection with OTel tracing enabled
 * - Performs various KV and query operations
 * - Exports all spans to Jaeger for visualization in the UI
 *
 * Prerequisites:
 * - Jaeger running locally (or update TRACING_ENDPOINT)
 * - Couchbase Server running
 * - OpenTelemetry packages installed
 *
 * Installation:
 *   npm install:
 *       - @opentelemetry/api (^1.9.0)
 *       - @opentelemetry/sdk-node (^0.213.0)
 *       - @opentelemetry/sdk-trace-node (^2.6.0)
 *       - @opentelemetry/exporter-trace-otlp-grpc (^0.213.0)
 *
 * Quick Start with Docker:
 *   # Start Jaeger (all-in-one with UI)
 *   docker-compose up -d
 *
 *   # Run this example
 *   tsx otel-otlp-tracing-exporter.ts
 *
 *   # Open Jaeger UI in browser
 *   # http://localhost:16686
 *
 * Expected output:
 * - Console logs showing operations being performed
 * - Traces visible in Jaeger UI at http://localhost:16686
 * - Search for service "couchbase-otel-tracing-example" in Jaeger UI
 */

import {
    defaultResource,
    resourceFromAttributes,
  } from '@opentelemetry/resources'
  import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'
  import {
    AlwaysOnSampler,
    NodeTracerProvider,
    ParentBasedSampler,
    BatchSpanProcessor,
  } from '@opentelemetry/sdk-trace-node'
  import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc'
  import { connect, getOTelTracer } from 'couchbase'
  
  // Configuration
  const SERVICE_NAME = 'couchbase-otel-tracing-example'
  const TRACING_ENDPOINT = 'http://localhost:4317'
  const CONNECTION_STRING = 'couchbase://192.168.107.128'
  const BUCKET_NAME = 'default'
  const USERNAME = 'Administrator'
  const PASSWORD = 'password'
  
  function setupOtelTracing(): NodeTracerProvider {
    const customResource = resourceFromAttributes({
      [ATTR_SERVICE_NAME]: SERVICE_NAME,
    })
    const resource = defaultResource().merge(customResource)
  
    const traceExporter = new OTLPTraceExporter({
      url: TRACING_ENDPOINT,
    })
  
    // Batching is highly recommended for production over the SimpleSpanProcessor
    const processor = new BatchSpanProcessor(traceExporter)
  
    const sampler = new ParentBasedSampler({
      root: new AlwaysOnSampler(), // Sample all root spans
    })
  
    const provider = new NodeTracerProvider({
      resource: resource,
      sampler: sampler,
      spanProcessors: [processor],
    })
  
    provider.register()
  
    return provider
  }
  
  function printBanner(): void {
    console.log('\n' + '='.repeat(80))
    console.log('OpenTelemetry OTLP Tracing Export Example (Jaeger)')
    console.log('='.repeat(80) + '\n')
  }
  
  async function performOperations(collection: any, cluster: any): Promise<void> {
    console.log('\n' + '-'.repeat(80))
    console.log('Performing Operations (Generating Traces)')
    console.log('-'.repeat(80) + '\n')
  
    const docs: Record<string, any> = {
      'tracing:1': { name: 'Alice', age: 30, type: 'user', user_role: 'admin' },
      'tracing:2': { name: 'Bob', age: 25, type: 'user', user_role: 'developer' },
      'tracing:3': {
        name: 'Charlie',
        age: 35,
        type: 'user',
        user_role: 'manager',
      },
      'tracing:4': {
        name: 'Diana',
        age: 28,
        type: 'user',
        user_role: 'designer',
      },
      'tracing:5': { name: 'Eve', age: 32, type: 'user', user_role: 'analyst' },
    }
  
    const docKeys = Object.keys(docs)
  
    console.log('1. Upserting documents...')
    for (const key of docKeys) {
      await collection.upsert(key, docs[key])
      console.log(`   ✓ Upserted '${key}'`)
    }
  
    console.log('\n2. Retrieving documents...')
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
      await collection.touch(key, 3600) // Expiry in seconds
      console.log(`   ✓ Touched '${key}'`)
    }
  
    console.log('\n5. Executing N1QL query...')
    const query = `SELECT name, user_role FROM \`${BUCKET_NAME}\` WHERE type = 'user' LIMIT 3`
    try {
      const result = await cluster.query(query)
      console.log(`   ✓ Query returned ${result.rows.length} rows`)
      for (const row of result.rows) {
        console.log(`      - ${row.name}: ${row.user_role}`)
      }
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
    let tracerProvider: NodeTracerProvider | null = null
  
    try {
      console.log('Setting up OpenTelemetry Tracing...')
      tracerProvider = setupOtelTracing()
      console.log('✓ OpenTelemetry Tracing configured\n')
  
      console.log(`Connecting to Couchbase at ${CONNECTION_STRING}...`)
  
      // Wrap the OTel tracer with the Couchbase SDK wrapper
      const couchbaseTracer = getOTelTracer(tracerProvider)
  
      const cluster = await connect(CONNECTION_STRING, {
        username: USERNAME,
        password: PASSWORD,
        tracer: couchbaseTracer, // Inject the tracing wrapper here!
      })
  
      const bucket = cluster.bucket(BUCKET_NAME)
      const collection = bucket.defaultCollection()
      console.log('✓ Connected to Couchbase\n')
  
      await performOperations(collection, cluster)
  
      console.log('\nClosing cluster connection...')
      await cluster.close()
    } catch (e) {
      console.error(`\nERROR:`, e)
    } finally {
      // CRITICAL: Forces all pending spans in the BatchSpanProcessor
      // to be exported over gRPC before Node exits!
      if (tracerProvider) {
        await tracerProvider.shutdown()
        console.log('✓ OpenTelemetry tracer shut down and spans flushed.')
  
        console.log('\n' + '='.repeat(80))
        console.log('SUCCESS! Traces Exported')
        console.log('='.repeat(80))
        console.log('\n🔎 VIEW TRACES IN JAEGER:')
        console.log('  • Jaeger UI: http://localhost:16686')
        console.log(`  • Select Service: '${SERVICE_NAME}'`)
        console.log("  • Click 'Find Traces'")
        console.log('='.repeat(80) + '\n')
      }
    }
  }
  
  main().catch((err) => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
  