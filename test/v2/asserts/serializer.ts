// Renders `CouchbaseError.context` on any error that escapes a test.
//
// The context is a property, not part of `message`, so no reporter prints it,
// and `CouchbaseError` discards its stack (`lib/errors.ts`), so without this an
// unexpected SDK error reports a name and a message and nothing else. Context
// fields are own properties whether or not the SDK filled them, so the empty
// ones are listed separately rather than shown as values.

import { beforeEach, onTestFailed } from 'vitest'

/** Longest rendered value before truncation. HTTP bodies can be enormous. */
const MAX_VALUE_LEN = 512

/** Rendered first when present; everything else follows in declaration order. */
const PREFERRED_ORDER: readonly string[] = [
  'key',
  'bucket',
  'scope',
  'collection',
  'status_code',
  'opaque',
  'cas',
  'context',
  'ref',
  'statement',
  'client_context_id',
  'index_name',
  'design_document',
  'view',
  'method',
  'request_path',
  'http_response_code',
  'response_code',
  'last_dispatched_to',
  'last_dispatched_from',
  'retry_attempts',
  'retry_reasons',
]

const MARKER = 'couchbase context'

/**
 * Vitest serializes the error before a hook sees it, which leaves these keys
 * behind and turns methods into strings like `Function<toString>`.
 */
const ARTIFACT_KEYS = new Set([
  'constructor',
  'toString',
  'stack',
  'name',
  'message',
])

function isArtifactValue(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith('Function<')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function renderValue(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined
  }
  if (Array.isArray(value)) {
    return value.length ? `[${value.map(String).join(',')}]` : undefined
  }
  if (typeof value === 'object') {
    try {
      const json = JSON.stringify(value)
      return json === '{}' ? undefined : truncate(json)
    } catch {
      return '<unserializable>'
    }
  }
  return truncate(String(value))
}

function truncate(text: string): string {
  const flat = text.replace(/\s+/g, ' ')
  return flat.length > MAX_VALUE_LEN
    ? `${flat.slice(0, MAX_VALUE_LEN)}… (${flat.length} chars)`
    : flat
}

/**
 * A hook may see the live error or Vitest's serialized copy, so the
 * constructor is either a function or a string like
 * `Function<KeyValueErrorContext>`.
 */
function contextClassName(context: Record<string, unknown>): string {
  const serialized = context.constructor
  if (typeof serialized === 'string') {
    const match = /^Function<(.+)>$/.exec(serialized)
    if (match) {
      return match[1]
    }
  }
  const name = (context.constructor as { name?: unknown } | undefined)?.name
  return typeof name === 'string' && name !== 'Object' ? name : 'ErrorContext'
}

/**
 * Undefined if the error carries no context. Duck-typed rather than
 * `instanceof CouchbaseError`, because a hook may see a serialized copy with
 * no prototype. One field per line, because the reporter truncates a long
 * line at terminal width.
 */
export function formatErrorContext(err: unknown): string | undefined {
  if (!isRecord(err)) {
    return undefined
  }
  const context = (err as { context?: unknown }).context
  if (!isRecord(context)) {
    return undefined
  }

  const keys = Object.keys(context).filter((k) => !ARTIFACT_KEYS.has(k))
  const ordered = [
    ...PREFERRED_ORDER.filter((k) => keys.includes(k)),
    ...keys.filter((k) => !PREFERRED_ORDER.includes(k)),
  ]

  const rendered: string[] = []
  const empty: string[] = []
  for (const key of ordered) {
    const raw = context[key]
    if (isArtifactValue(raw)) {
      continue
    }
    const value = renderValue(raw)
    if (value === undefined) {
      empty.push(key)
    } else {
      rendered.push(`${key}=${value}`)
    }
  }

  if (rendered.length === 0) {
    return undefined
  }

  const lines = [`${MARKER} (${contextClassName(context)}):`]
  for (const field of rendered) {
    lines.push(`    ${field}`)
  }
  if (empty.length > 0) {
    // Named rather than omitted: the difference between "the serializer has
    // nothing" and "the SDK sent nothing" is the whole point.
    lines.push(`    (no value: ${empty.join(', ')})`)
  }
  return lines.join('\n')
}

/**
 * Appends the rendered context to the error's own message, once, so it travels
 * wherever the message is shown.
 */
export function augmentCouchbaseError(err: unknown): void {
  const rendered = formatErrorContext(err)
  if (!rendered) {
    return
  }
  const error = err as { message?: string }
  if (typeof error.message !== 'string' || error.message.includes(MARKER)) {
    return
  }
  error.message = `${error.message}\n  ${rendered}`
}

function errorsOf(context: unknown): unknown[] {
  // No `isRecord` guard: Vitest hands the hook a callable proxy, so
  // `typeof context` is 'function' and an object-only guard would silently
  // reject every failure.
  const task = (context as { task?: { result?: { errors?: unknown } } })?.task
  const errors = task?.result?.errors
  return Array.isArray(errors) ? errors : []
}

/**
 * Installs the serializer for the current file. Called from `setup.ts`, which
 * every test file loads, so no suite has to opt in.
 */
export function installErrorSerializer(): void {
  // Registered through `beforeEach` because `onTestFailed` binds to the running
  // test: called at a setup file's top level there is no test to attach to.
  beforeEach(() => {
    onTestFailed((context) => {
      const errors = errorsOf(context)
      for (const err of errors) {
        augmentCouchbaseError(err)
      }
    })
  })
}
