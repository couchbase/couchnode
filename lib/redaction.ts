/**
 * Log redaction tags for the SDK's own log output.
 *
 * The SDK never removes or obscures anything itself: while redaction is
 * enabled it wraps sensitive values in tags that an external tool can strip
 * or hash. Redaction is process wide, and is enabled when a cluster connects
 * with `logRedaction` (or the `log_redaction` connection string option) set.
 *
 *   `<ud>` user data: document keys and values, usernames, query statements
 *   `<md>` metadata: bucket, scope, collection and index names
 *   `<sd>` system data: hostnames, IP addresses, ports
 *
 * A serialized document is tagged as a whole, never a value inside it, at the
 * strictest category it may contain.
 *
 * @internal
 */

import binding from './binding'

// A newline splits a tagged value across lines, and the line oriented tool
// that consumes the tags then passes it through in clear text. A tag sequence
// inside the value closes its span early. Only the "<" of a real tag sequence
// is escaped, so ordinary markup stays readable. Both escapes are JSON's own,
// so a tagged JSON document still parses to the original values.
const ESCAPED = /\r|\n|<(?=\/?(?:ud|md|sd)>)/g
const ESCAPES: Record<string, string> = {
  '\r': '\\r',
  '\n': '\\n',
  '<': '\\u003c',
}

/**
 * Renders a value as a string and, while log redaction is enabled, wraps it
 * in the `name` tag with its line breaks and tag sequences escaped.
 *
 * @internal
 */
function tag(name: string, value: unknown): string {
  const str = String(value)
  if (!binding.isLogRedactionEnabled()) {
    return str
  }
  return `<${name}>${str.replace(ESCAPED, (c) => ESCAPES[c])}</${name}>`
}

/**
 * Tags a value as user data (`<ud>`) while log redaction is enabled.
 *
 * @internal
 */
export function userData(value: unknown): string {
  return tag('ud', value)
}

/**
 * Tags a value as metadata (`<md>`) while log redaction is enabled.
 *
 * @internal
 */
export function metaData(value: unknown): string {
  return tag('md', value)
}

/**
 * Tags a value as system data (`<sd>`) while log redaction is enabled.
 *
 * @internal
 */
export function systemData(value: unknown): string {
  return tag('sd', value)
}
