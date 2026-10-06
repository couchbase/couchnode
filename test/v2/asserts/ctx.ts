// Contextual assertion messages.
//
// The target is a message that says what was compared and where:
//
//   BucketName attribute: expected='travel-sample' actual='default'. op=upsert |
//   span=cb.upsert | attrs=db.system,db.name | children=2
//
// A suite body runs once per collection strategy, so every helper appends
// these fields, the strategy among them, to say which run failed.

export interface AssertCtx {
  op?: string
  key?: string
  bucket?: string
  scope?: string
  collection?: string
  strategy?: string
  serverVersion?: string
  extra?: string
}

const ORDER: readonly (keyof AssertCtx)[] = [
  'op',
  'key',
  'bucket',
  'scope',
  'collection',
  'strategy',
  'serverVersion',
  'extra',
]

/** `' | '`-joined `k=v`, empty parts dropped. */
export function ctx(c: AssertCtx = {}): string {
  const parts: string[] = []
  for (const field of ORDER) {
    const value = c[field]
    if (value !== undefined && value !== '') {
      parts.push(field === 'extra' ? value : `${field}=${value}`)
    }
  }
  return parts.join(' | ')
}

export function withCtx(what: string, c: AssertCtx = {}): string {
  const rendered = ctx(c)
  return rendered ? `${what}. ${rendered}` : what
}
