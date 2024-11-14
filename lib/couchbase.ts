import binding from './binding'
import { Cluster, ConnectOptions } from './cluster'
import { NodeCallback } from './utilities'

/**
 * Acts as the entrypoint into the rest of the library.  Connecting to the cluster
 * and exposing the various services and features.
 *
 * @param connStr The connection string to use to connect to the cluster.
 * @param options Optional parameters for this operation.
 * @param callback A node-style callback to be invoked after execution.
 * @category Core
 */
export async function connect(
  connStr: string,
  options?: ConnectOptions,
  callback?: NodeCallback<Cluster>
): Promise<Cluster> {
  return Cluster.connect(connStr, options, callback)
}

/**
 * Exposes the underlying couchbase++ library version that is being used by the
 * SDK to perform I/O with the cluster.
 *
 * @deprecated Use {@link cbppVersion} instead.
 */
export const lcbVersion: string = binding.cbppVersion

/**
 * Exposes the underlying couchbase++ library version that is being used by the
 * SDK to perform I/O with the cluster.
 */
export const cbppVersion: string = binding.cbppVersion
export const cbppMetadata: string = binding.cbppMetadata

/**
 * Volatile: This API is subject to change at any time.
 *
 * Exposes the underlying couchbase++ library protocol logger.  This method is for
 * logging/debugging purposes and must be used with caution as network details will
 * be logged to the provided file.
 *
 * @param filename Name of file protocol logger will save logging details.
 */
export function enableProtocolLoggerToSaveNetworkTrafficToFile(
  filename: string
): void {
  binding.enableProtocolLogger(filename)
}

/**
 * Volatile: This API is subject to change at any time.
 *
 * Shutdowns the underlying couchbase++ logger.
 *
 */
export function shutdownLogger(): void {
  binding.shutdownLogger()
}

export * from './analyticsindexmanager'
export * from './analyticstypes'
export * from './authenticators'
export * from './binarycollection'
export * from './bucket'
export * from './bucketmanager'
export * from './cluster'
export * from './collection'
export * from './collectionmanager'
export * from './crudoptypes'
export * from './datastructures'
export * from './diagnosticstypes'
export * from './errorcontexts'
export * from './errors'
export * from './eventingfunctionmanager'
export * from './generaltypes'
export * from './mutationstate'
export * from './queryindexmanager'
export * from './querytypes'
export * from './rangeScan'
export * from './scope'
export * from './scopeeventingfunctionmanager'
export * from './scopesearchindexmanager'
export * from './sdspecs'
export * from './searchfacet'
export * from './searchindexmanager'
export * from './searchquery'
export * from './searchsort'
export * from './searchtypes'
export * from './streamablepromises'
export * from './transactions'
export * from './transcoders'
export * from './usermanager'
export * from './vectorsearch'
export * from './viewexecutor'
export * from './viewindexmanager'
export * from './viewtypes'

export { Cas, CasInput, NodeCallback } from './utilities'
