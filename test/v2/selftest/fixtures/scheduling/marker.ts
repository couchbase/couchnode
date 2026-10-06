// Shared by the fixture suites: record when a file's work started and ended.
//
// Written to a file, not stdout: Vitest's interleaving of worker output says
// nothing about when the work ran.

import { appendFileSync } from 'fs'

const LOG = process.env.CNSCHEDLOG

/** How long each fixture file holds its slot. Long enough to overlap visibly. */
export const HOLD_MS = 400

export async function occupy(label: string): Promise<void> {
  if (!LOG) {
    throw new Error(
      'CNSCHEDLOG is unset, so there is nowhere to record the timeline'
    )
  }
  appendFileSync(LOG, `${label} start ${Date.now()}\n`)
  await new Promise((resolve) => setTimeout(resolve, HOLD_MS))
  appendFileSync(LOG, `${label} end ${Date.now()}\n`)
}
