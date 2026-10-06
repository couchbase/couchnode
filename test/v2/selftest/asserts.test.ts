import { describe, expect, it } from 'vitest'

import { ctx, withCtx } from '../asserts/ctx'
import {
  augmentCouchbaseError,
  formatErrorContext,
} from '../asserts/serializer'

class FakeKeyValueContext {
  constructor(
    readonly key: string | undefined,
    readonly bucket: string | undefined,
    readonly status_code: number,
    readonly opaque: number,
    readonly last_dispatched_to: string,
    readonly retry_attempts: number,
    readonly retry_reasons: string[]
  ) {}
}

describe('assertion context', () => {
  it('joins what it knows and drops what it does not', () => {
    expect(ctx({ op: 'get', key: 'k1' })).toBe('op=get | key=k1')
    expect(ctx({})).toBe('')
    expect(ctx({ op: 'upsert', collection: 'test', strategy: 'named' })).toBe(
      'op=upsert | collection=test | strategy=named'
    )
  })

  it('renders extra without a key, as free text', () => {
    expect(ctx({ op: 'get', extra: 'attempt 3' })).toBe('op=get | attempt 3')
  })

  it('appends the context to a message', () => {
    expect(withCtx('cas did not change', { op: 'replace' })).toBe(
      'cas did not change. op=replace'
    )
    expect(withCtx('no context here')).toBe('no context here')
  })
})

describe('error serializer', () => {
  it('renders the fields that carry a value', () => {
    const err = Object.assign(new Error('document not found'), {
      context: new FakeKeyValueContext(
        undefined,
        undefined,
        1,
        42,
        '10.0.0.1:11210',
        2,
        ['socket_not_available']
      ),
    })

    const rendered = formatErrorContext(err)
    expect(rendered).toContain('status_code=1')
    expect(rendered).toContain('opaque=42')
    expect(rendered).toContain('last_dispatched_to=10.0.0.1:11210')
    expect(rendered).toContain('retry_reasons=[socket_not_available]')
  })

  it('says which fields had no value, so a thin dump is legible', () => {
    // Listing empty fields is the difference between "the serializer has
    // nothing" and "the SDK sent nothing".
    const err = Object.assign(new Error('document not found'), {
      context: new FakeKeyValueContext(
        undefined,
        undefined,
        1,
        42,
        '10.0.0.1:11210',
        0,
        []
      ),
    })
    const rendered = formatErrorContext(err)
    expect(rendered).toContain('no value: key, bucket')
  })

  it('names the context class, so the reader knows which shape it is', () => {
    const err = Object.assign(new Error('boom'), {
      context: new FakeKeyValueContext('k', 'b', 1, 2, 'host:1', 0, []),
    })
    expect(formatErrorContext(err)).toContain(
      'couchbase context (FakeKeyValueContext)'
    )
  })

  it("reads the class name out of Vitest's serialized copy", () => {
    // By the time a hook sees a failure, Vitest has replaced the prototype with
    // a string: `constructor: 'Function<KeyValueErrorContext>'`. Reading the
    // name from that is what keeps the label right on a reported failure, as
    // opposed to on an error caught inside a test.
    const rendered = formatErrorContext({
      message: 'document not found',
      context: {
        constructor: 'Function<KeyValueErrorContext>',
        toString: 'Function<toString>',
        status_code: 1,
        last_dispatched_to: '10.0.0.1:11210',
      },
    })
    expect(rendered).toContain('couchbase context (KeyValueErrorContext)')
    expect(rendered).toContain('status_code=1')
    // The serialization artifacts must not be rendered as context fields.
    expect(rendered).not.toContain('Function<')
    expect(rendered).not.toContain('toString')
  })

  it('renders one field per line, because a long line gets truncated', () => {
    const err = Object.assign(new Error('boom'), {
      context: new FakeKeyValueContext('k', 'b', 1, 2, 'host:1', 3, ['x']),
    })
    const lines = (formatErrorContext(err) ?? '').split('\n')
    expect(lines.length).toBeGreaterThan(4)
    for (const line of lines) {
      expect(line.length).toBeLessThan(100)
    }
  })

  it('ignores errors with no context', () => {
    expect(formatErrorContext(new Error('plain'))).toBeUndefined()
    expect(formatErrorContext('not an error')).toBeUndefined()
    expect(
      formatErrorContext(Object.assign(new Error('x'), { context: {} }))
    ).toBeUndefined()
  })

  it('appends to the message exactly once', () => {
    const err = Object.assign(new Error('document not found'), {
      context: new FakeKeyValueContext('k', 'b', 1, 2, 'host:1', 0, []),
    })
    augmentCouchbaseError(err)
    augmentCouchbaseError(err)
    const occurrences = err.message.split('couchbase context').length - 1
    expect(occurrences).toBe(1)
    expect(err.message.startsWith('document not found')).toBe(true)
  })

  it('truncates a value that would bury the message', () => {
    const err = Object.assign(new Error('query failed'), {
      context: { http_response_body: 'x'.repeat(5_000) },
    })
    const rendered = formatErrorContext(err) ?? ''
    expect(rendered.length).toBeLessThan(1_000)
    expect(rendered).toContain('5000 chars')
  })
})
