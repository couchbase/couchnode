// Once per run, in the main process: start a backend if we need one, probe the
// cluster, and publish the result to every worker.
//
// A failed probe fails the whole run; there is no fallback version that would
// quietly skip every version-gated test. Teardown is called explicitly when
// setup throws, because Vitest only registers it on success and a started
// backend would be orphaned.

import type { TestProject } from 'vitest/node'

import { formatVersion } from './infra/capabilities'
import { TestConfig, hasNoCluster, loadTestConfig } from './infra/config'
import { ClusterConnection } from './infra/env'
import { GoCavesBackend } from './infra/mock/gocaves'
import { MockBackend } from './infra/mock/backend'
import { newRunId } from './infra/naming'
import {
  backendCapabilities,
  describeCapabilities,
  openProbeConnection,
  probeCapabilities,
} from './infra/probe'
import { RunState } from './infra/runstate'
import {
  createRunLog,
  readNotices,
  removeRunLog,
  summarizeNotices,
} from './infra/runlog'

/** The one project that needs no server. `vitest.config.mts` must agree. */
export const UNIT_PROJECT = 'unit'

export default async function setup(
  project: TestProject
): Promise<() => Promise<void>> {
  const provide = project.provide.bind(project)
  const config = loadTestConfig()
  const runId = newRunId()
  const runLog = createRunLog(runId)
  let backend: MockBackend | undefined

  const teardown = async () => {
    if (backend) {
      await backend.stop()
      backend = undefined
    }
    const notices = readNotices(runLog)
    // Printed here because this is the main process: a reason logged in a
    // worker is hidden whenever its file passes, which is exactly when a
    // silently skipped suite matters most.
    const summary = summarizeNotices(notices)
    if (summary) {
      console.log(summary)
    }
    removeRunLog(runLog)
  }

  try {
    const noCluster = clusterFreeReason(project, config)
    if (noCluster) {
      const state: RunState = {
        kind: 'no-cluster',
        config,
        runId,
        runLog,
        reason: noCluster,
      }
      provide('runState', state)
      console.log(`[test/v2] ${state.reason}`)
      return teardown
    }

    let connection: ClusterConnection
    let capabilities

    if (config.connectionString) {
      connection = {
        connectionString: config.connectionString,
        username: config.username,
        password: config.password,
      }
      const probeCluster = await openProbeConnection(connection)
      try {
        capabilities = await probeCapabilities(probeCluster, {
          backend: 'none',
          overrides: config.featureOverrides,
          versionOverride: config.versionOverride,
        })
      } finally {
        await probeCluster.close()
      }
    } else {
      backend = createBackend(config)
      connection = await backend.start()
      capabilities = backendCapabilities(backend.version(), {
        backend: config.mockBackend,
        overrides: config.featureOverrides,
        versionOverride: config.versionOverride,
      })
    }

    const state: RunState = {
      kind: 'ready',
      config,
      capabilities,
      connection,
      runId,
      runLog,
      description: describeCapabilities(capabilities),
    }
    provide('runState', state)

    console.log(
      `[test/v2] run ${runId} against ${state.description}` +
        (config.versionOverride
          ? ` (CNCVER override: ${formatVersion(config.versionOverride)})`
          : '')
    )

    return teardown
  } catch (err) {
    await teardown()
    throw err
  }
}

/**
 * Why this run needs no server, or `undefined` if it does need one: either no
 * cluster is configured, or only the `unit` project was selected. The second
 * matters because a root `globalSetup` runs whatever `--project` was passed,
 * so `--project unit` would otherwise still probe or spawn a mock.
 */
function clusterFreeReason(
  project: TestProject,
  config: TestConfig
): string | undefined {
  const selected = project.vitest.projects.map((p) => p.name)
  if (selected.length > 0 && selected.every((name) => name === UNIT_PROJECT)) {
    return (
      `Only the '${UNIT_PROJECT}' project was selected, and it needs no ` +
      'server. Starting neither a backend nor a probe connection.'
    )
  }
  if (hasNoCluster(config)) {
    return (
      'No cluster is configured: CNCSTR is unset and CNMOCK=none. ' +
      'Suites that need a server are skipped.'
    )
  }
  return undefined
}

function createBackend(config: TestConfig): MockBackend {
  return new GoCavesBackend({
    binaryPath: config.gocavesPath,
    urlBase: config.gocavesUrl,
    version: config.gocavesVersion,
  })
}
