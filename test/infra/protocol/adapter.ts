// The one seam between the test infrastructure and the wire protocol.
//
// **A test-infra operation that reaches outside the SDK's public surface
// belongs here.** Everything else needs no seam, which is why the same suites
// can run under a second protocol without being forked. Both members are
// classic-only: `probe` uses the core's `managementClusterDescribe`, which does
// not exist under `couchbase2` (so it throws), and readiness is
// `consistency.ts`'s per-node HTTP poll.

import type { Cluster } from '../../../lib/cluster'
import { ClusterCapabilities, TestProtocol } from '../capabilities'
import type { ConsistencyOptions, ConsistencyUtils } from '../consistency'
import { CapabilitiesInput, probeCapabilities } from '../probe'

/**
 * Everything protocol-bound. The readiness members mirror `ConsistencyUtils`
 * one for one, so the classic implementation is plain delegation.
 */
export interface ProtocolAdapter {
  readonly protocol: TestProtocol

  /** What the cluster can do. Throws rather than degrading; see above. */
  probe(
    cluster: Cluster,
    input: CapabilitiesInput
  ): Promise<ClusterCapabilities>

  waitUntilBucketPresent(
    bucketName: string,
    opts?: ConsistencyOptions
  ): Promise<void>
  waitUntilBucketDropped(
    bucketName: string,
    opts?: ConsistencyOptions
  ): Promise<void>
  waitUntilScopePresent(
    bucketName: string,
    scopeName: string,
    opts?: ConsistencyOptions
  ): Promise<void>
  waitUntilScopeDropped(
    bucketName: string,
    scopeName: string,
    opts?: ConsistencyOptions
  ): Promise<void>
  waitUntilCollectionPresent(
    bucketName: string,
    scopeName: string,
    collectionName: string,
    opts?: ConsistencyOptions
  ): Promise<void>
  waitUntilCollectionDropped(
    bucketName: string,
    scopeName: string,
    collectionName: string,
    opts?: ConsistencyOptions
  ): Promise<void>
  waitUntilDesignDocumentPresent(
    bucketName: string,
    designDocumentName: string,
    opts?: ConsistencyOptions
  ): Promise<void>
  waitUntilDesignDocumentDropped(
    bucketName: string,
    designDocumentName: string,
    opts?: ConsistencyOptions
  ): Promise<void>
}

/** The classic protocol: forwards unchanged, so the seam cannot alter a run. */
export class ClassicProtocolAdapter implements ProtocolAdapter {
  readonly protocol = TestProtocol.Classic

  constructor(private readonly consistency: ConsistencyUtils) {}

  probe(
    cluster: Cluster,
    input: CapabilitiesInput
  ): Promise<ClusterCapabilities> {
    return probeCapabilities(cluster, input)
  }

  waitUntilBucketPresent(b: string, o?: ConsistencyOptions): Promise<void> {
    return this.consistency.waitUntilBucketPresent(b, o)
  }
  waitUntilBucketDropped(b: string, o?: ConsistencyOptions): Promise<void> {
    return this.consistency.waitUntilBucketDropped(b, o)
  }
  waitUntilScopePresent(
    b: string,
    s: string,
    o?: ConsistencyOptions
  ): Promise<void> {
    return this.consistency.waitUntilScopePresent(b, s, o)
  }
  waitUntilScopeDropped(
    b: string,
    s: string,
    o?: ConsistencyOptions
  ): Promise<void> {
    return this.consistency.waitUntilScopeDropped(b, s, o)
  }
  waitUntilCollectionPresent(
    b: string,
    s: string,
    c: string,
    o?: ConsistencyOptions
  ): Promise<void> {
    return this.consistency.waitUntilCollectionPresent(b, s, c, o)
  }
  waitUntilCollectionDropped(
    b: string,
    s: string,
    c: string,
    o?: ConsistencyOptions
  ): Promise<void> {
    return this.consistency.waitUntilCollectionDropped(b, s, c, o)
  }
  waitUntilDesignDocumentPresent(
    b: string,
    d: string,
    o?: ConsistencyOptions
  ): Promise<void> {
    return this.consistency.waitUntilDesignDocumentPresent(b, d, o)
  }
  waitUntilDesignDocumentDropped(
    b: string,
    d: string,
    o?: ConsistencyOptions
  ): Promise<void> {
    return this.consistency.waitUntilDesignDocumentDropped(b, d, o)
  }
}

/**
 * The registry. Adding `couchbase2` is a case here and an implementation file.
 * It throws rather than falling back to classic, which would poll a gateway's
 * nonexistent management port and report the timeouts as ordinary flake.
 */
export function adapterFor(
  protocol: TestProtocol,
  consistency: ConsistencyUtils
): ProtocolAdapter {
  switch (protocol) {
    case TestProtocol.Classic:
      return new ClassicProtocolAdapter(consistency)
    case TestProtocol.Couchbase2:
      throw new Error(
        'couchbase2 has no ProtocolAdapter implementation yet. The capability ' +
          'model, the gap map and this seam are registered; connection ' +
          'handling and the adapter itself belong to the Cloud Native Gateway ' +
          'work.'
      )
  }
}
