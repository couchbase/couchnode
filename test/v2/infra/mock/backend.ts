// What a mock backend can do lives in `BACKEND_UNSUPPORTED` (capabilities.ts),
// not in a boolean threaded through the gating code.

import { MockBackendKind, ServerVersion } from '../capabilities'

export interface MockConnection {
  readonly connectionString: string
  readonly username: string
  readonly password: string
}

export interface MockBackend {
  readonly kind: MockBackendKind
  start(): Promise<MockConnection>
  /**
   * Must leave no child process behind, and must not rely on the backend
   * noticing that we went away: left to notice, it outlives the run.
   */
  stop(): Promise<void>
  version(): ServerVersion
  /** Backend-specific control channel; not all backends support all commands. */
  command?(
    name: string,
    payload?: Readonly<Record<string, unknown>>
  ): Promise<unknown>
}
