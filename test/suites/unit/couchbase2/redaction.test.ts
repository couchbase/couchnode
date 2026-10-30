import { describe, expect, it, vi } from 'vitest'

interface Sdk {
  /** Builds a backend, which sends nothing, so no gateway is needed. */
  open: (connStr: string, logRedaction?: boolean) => void
  /** The same, through the cluster, which passes its logRedaction on. */
  openCluster: (connStr: string, logRedaction?: boolean) => Promise<void>
  metaData: (value: unknown) => string
  bindingLoaded: () => boolean
}

/**
 * Redaction cannot be turned off once on, so each use of this fixture imports
 * the SDK's modules afresh and starts with it disabled. Everything opened
 * through it is closed at teardown.
 */
async function importSdk(): Promise<{ sdk: Sdk; close: () => Promise<void> }> {
  vi.resetModules()
  const { PasswordAuthenticator } = await import(
    '../../../../lib/authenticators'
  )
  const { bindingLoaded } = await import('../../../../lib/binding')
  const { Cluster } = await import('../../../../lib/cluster')
  const { Couchbase2Backend } = await import(
    '../../../../lib/couchbase2/backend'
  )
  const { CouchbaseLogger } = await import('../../../../lib/logger')
  const { metaData } = await import('../../../../lib/redaction')

  const auth = new PasswordAuthenticator('Administrator', 'password')
  const opened: { close: () => Promise<void> }[] = []
  const sdk: Sdk = {
    open: (connStr, logRedaction) => {
      opened.push(
        new Couchbase2Backend({
          connStr,
          auth,
          logger: new CouchbaseLogger({}),
          logRedaction,
        })
      )
    },
    openCluster: async (connStr, logRedaction) => {
      opened.push(
        await Cluster.connect(connStr, { authenticator: auth, logRedaction })
      )
    },
    metaData,
    bindingLoaded,
  }
  const close = async () => {
    await Promise.all(opened.map((o) => o.close()))
  }
  return { sdk, close }
}

const test = it.extend<{ sdk: Sdk; freshSdk: () => Promise<Sdk> }>({
  // eslint-disable-next-line no-empty-pattern
  sdk: async ({}, use) => {
    const { sdk, close } = await importSdk()
    await use(sdk)
    await close()
  },
  // A second, independent import, for a test that needs two.
  // eslint-disable-next-line no-empty-pattern
  freshSdk: async ({}, use) => {
    const closers: (() => Promise<void>)[] = []
    await use(async () => {
      const { sdk, close } = await importSdk()
      closers.push(close)
      return sdk
    })
    await Promise.all(closers.map((close) => close()))
  },
})

describe('#couchbase2 log redaction', () => {
  test('leaves redaction disabled by default', ({ sdk }) => {
    sdk.open('couchbase2://localhost')
    expect(sdk.metaData('default')).toBe('default')
  })

  test('enables redaction from log_redaction without loading the addon', ({
    sdk,
  }) => {
    sdk.open('couchbase2://localhost?log_redaction=true')
    expect(sdk.metaData('default')).toBe('<md>default</md>')
    expect(sdk.bindingLoaded(), 'addon loaded').toBe(false)
  })

  test('takes logRedaction over log_redaction', async ({ freshSdk }) => {
    const on = await freshSdk()
    on.open('couchbase2://localhost?log_redaction=false', true)
    expect(on.metaData('default'), 'logRedaction true').toBe('<md>default</md>')

    const off = await freshSdk()
    off.open('couchbase2://localhost?log_redaction=true', false)
    expect(off.metaData('default'), 'logRedaction false').toBe('default')
  })

  test('stays enabled once enabled', ({ sdk }) => {
    sdk.open('couchbase2://localhost', true)
    sdk.open('couchbase2://localhost', false)
    expect(sdk.metaData('default')).toBe('<md>default</md>')
  })

  test('enables redaction from the logRedaction cluster option', async ({
    sdk,
  }) => {
    await sdk.openCluster('couchbase2://localhost:1', true)
    expect(sdk.metaData('default')).toBe('<md>default</md>')
    expect(sdk.bindingLoaded(), 'addon loaded').toBe(false)
  })
})
