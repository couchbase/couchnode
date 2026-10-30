'use strict'

const fs = require('fs')
const path = require('path')

// tsc emits only the compiled modules, so the protos that
// lib/couchbase2/schema.ts loads at run time are copied beside them,
// replacing whatever an earlier build left.
const source = path.join(__dirname, '../lib/couchbase2/protos')
const target = path.join(__dirname, '../dist/couchbase2/protos')

fs.rmSync(target, { recursive: true, force: true })
fs.cpSync(source, target, { recursive: true })

console.log('[Build] Copied lib/couchbase2/protos to dist/couchbase2/protos')
