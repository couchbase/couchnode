// The worker `shutdowntimeout.exitfixture.ts` terminates. It opens a connection,
// never connects it, blocks the connection's IO thread, and tells the parent,
// so that terminate runs the connection's shutdown with its close stalled.
//
// Plain .cjs, loading the addon the way `lib/binding.ts` does, so it needs no
// TypeScript of its own.
const path = require('path')
const worker = require('worker_threads')
const { loadPrebuild } = require('../../../scripts/prebuilds')

const binding = loadPrebuild(path.resolve(__dirname, '..', '..', '..'))
const conn = new binding.Connection()
conn._stallIo(worker.workerData.stallMs)
worker.parentPort.postMessage('stalled')
// Stay alive, so terminate is what ends this thread. The timer holds the
// connection, so it is not collected first: its finalizer would shut it down
// without waiting, which is not the path under test.
setTimeout(() => conn, 10 * 60_000)
