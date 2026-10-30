import * as os from 'os'
import { inspect } from 'util'
import { describe, expect, it } from 'vitest'

import type {
  DocumentId,
  KvAppendRequest,
  KvCounterRequest,
  KvGetRequest,
  KvInsertRequest,
  KvLookupInReplicaRequest,
  KvLookupInRequest,
  KvMutateInRequest,
  KvPrependRequest,
  KvRemoveRequest,
  KvReplaceRequest,
  KvReplicaReadRequest,
  KvScanRequest,
  KvUpsertRequest,
} from '../../../../lib/backends'
import type { Collection } from '../../../../lib/collection'
import type { KvServiceClient } from '../../../../lib/couchbase2/generated/couchbase/kv/v1/KvService'
import type { Status__Output as StatusOutputPb } from '../../../../lib/couchbase2/generated/google/rpc/Status'
import type { Couchbase2KvChannel } from '../../../../lib/couchbase2/kv'
import {
  Couchbase2Cas,
  Couchbase2Kv,
  Couchbase2MutationToken,
  appendRequestToProto,
  casToProto,
  counterRequestToProto,
  counterResultFromProto,
  existsRequestToProto,
  existsResultFromProto,
  expiryToProto,
  getAndLockRequestToProto,
  getAndTouchRequestToProto,
  getRequestToProto,
  getResultFromProto,
  insertRequestToProto,
  lockedOrTouchedResultFromProto,
  lookupInRequestToProto,
  lookupInResultFromProto,
  mutateInRequestToProto,
  mutateInResultFromProto,
  mutationResultFromProto,
  prependRequestToProto,
  removeRequestToProto,
  replaceRequestToProto,
  touchExpiryToProto,
  touchRequestToProto,
  unlockRequestToProto,
  upsertRequestToProto,
  xattrsFirst,
} from '../../../../lib/couchbase2/kv'
import { loadSchema } from '../../../../lib/couchbase2/schema'
import {
  FeatureNotAvailableError,
  InternalServerFailureError,
  InvalidArgumentError,
  InvalidDurabilityLevel,
  PathMismatchError,
  PathNotFoundError,
} from '../../../../lib/errors'
import { DurabilityLevel, StoreSemantics } from '../../../../lib/generaltypes'
import { MutationState } from '../../../../lib/mutationstate'
import { PrefixScan } from '../../../../lib/rangeScan'
import {
  LookupInSpec,
  MutateInMacro,
  MutateInSpec,
} from '../../../../lib/sdspecs'
import { DefaultTranscoder } from '../../../../lib/transcoders'

// The key-value requests and results, mapped without a gateway.

const id: DocumentId = { bucket: 'b', scope: 's', collection: 'c', key: 'k' }

const transcoder = new DefaultTranscoder()

function getReq(overrides: Partial<KvGetRequest> = {}): KvGetRequest {
  return {
    id,
    timeout: 2500,
    obs: null,
    transcoder,
    withExpiry: false,
    ...overrides,
  }
}

function upsertReq(overrides: Partial<KvUpsertRequest> = {}): KvUpsertRequest {
  const [value, flags] = transcoder.encode({ a: 1 })
  return {
    id,
    timeout: 2500,
    obs: null,
    value,
    flags,
    expiry: 0,
    preserveExpiry: false,
    durabilityLevel: DurabilityLevel.None,
    ...overrides,
  }
}

function insertReq(overrides: Partial<KvInsertRequest> = {}): KvInsertRequest {
  const [value, flags] = transcoder.encode({ a: 1 })
  return {
    id,
    timeout: 2500,
    obs: null,
    value,
    flags,
    expiry: 0,
    durabilityLevel: DurabilityLevel.None,
    ...overrides,
  }
}

function replaceReq(
  overrides: Partial<KvReplaceRequest> = {}
): KvReplaceRequest {
  return { ...upsertReq(), ...overrides }
}

function removeReq(overrides: Partial<KvRemoveRequest> = {}): KvRemoveRequest {
  return {
    id,
    timeout: 2500,
    obs: null,
    durabilityLevel: DurabilityLevel.None,
    ...overrides,
  }
}

/**
 * The eight bytes of `value` in the platform's byte order, as a classic
 * connection's CAS holds them.
 */
function casBytes(value: bigint): Buffer {
  const buf = Buffer.alloc(8)
  if (os.endianness() === 'LE') {
    buf.writeBigUInt64LE(value)
  } else {
    buf.writeBigUInt64BE(value)
  }
  return buf
}

const MAJORITY = { durabilityLevel: DurabilityLevel.Majority }

const DOCUMENT = {
  bucket_name: 'b',
  scope_name: 's',
  collection_name: 'c',
  key: 'k',
}

describe('#couchbase2 kv get', () => {
  it('should name the document and its projections', () => {
    expect(getRequestToProto(getReq())).toEqual({ ...DOCUMENT, project: [] })
    expect(getRequestToProto(getReq({ project: ['a', 'b.c'] }))).toEqual({
      ...DOCUMENT,
      project: ['a', 'b.c'],
    })
  })

  it('should decode the content and keep the CAS', () => {
    const [content, flags] = transcoder.encode({ a: 1 })
    const result = getResultFromProto(
      {
        content: 'content_uncompressed',
        content_uncompressed: content,
        content_flags: flags,
        cas: '1700000000000000001',
        expiry: { seconds: '1800000000', nanos: 0 },
      },
      getReq()
    )
    expect(result.content).toEqual({ a: 1 })
    expect(result.cas.toString()).toBe('1700000000000000001')
    expect(result.expiryTime).toBeUndefined()
  })

  it.each([
    [{ seconds: '1800000000', nanos: 0 }, 1800000000],
    [null, 0],
  ])('should carry the expiry %j only when asked', (expiry, expected) => {
    const [content, flags] = transcoder.encode('v')
    const result = getResultFromProto(
      {
        content: 'content_uncompressed',
        content_uncompressed: content,
        content_flags: flags,
        cas: '1',
        expiry,
      },
      getReq({ withExpiry: true })
    )
    expect(result.expiryTime).toBe(expected)
  })

  it('should refuse compressed content', () => {
    expect(() =>
      getResultFromProto(
        {
          content: 'content_compressed',
          content_compressed: Buffer.from('x'),
          content_flags: 0,
          cas: '1',
          expiry: null,
        },
        getReq()
      )
    ).toThrow(InternalServerFailureError)
  })
})

describe('#couchbase2 kv upsert', () => {
  it.each([
    [0, false, { expiry_secs: 0 }],
    [0, true, {}],
    [60, false, { expiry_secs: 60 }],
    [60, true, { expiry_secs: 60, preserve_expiry_on_existing: true }],
    [30 * 24 * 60 * 60, false, { expiry_secs: 30 * 24 * 60 * 60 }],
    [1800000000, false, { expiry_time: { seconds: 1800000000 } }],
    [
      1800000000,
      true,
      {
        expiry_time: { seconds: 1800000000 },
        preserve_expiry_on_existing: true,
      },
    ],
  ])(
    'should send expiry %d with preserveExpiry %s as %j',
    (expiry, preserve, expected) => {
      expect(expiryToProto(expiry, preserve)).toEqual(expected)
    }
  )

  it('should send the encoded value, its flags and no durability', () => {
    const req = upsertReq()
    expect(upsertRequestToProto(req)).toEqual({
      ...DOCUMENT,
      content_uncompressed: req.value,
      content_flags: req.flags,
      expiry_secs: 0,
    })
  })

  it.each([
    [DurabilityLevel.Majority, 'DURABILITY_LEVEL_MAJORITY'],
    [
      DurabilityLevel.MajorityAndPersistOnMaster,
      'DURABILITY_LEVEL_MAJORITY_AND_PERSIST_TO_ACTIVE',
    ],
    [DurabilityLevel.PersistToMajority, 'DURABILITY_LEVEL_PERSIST_TO_MAJORITY'],
  ])('should send durability %s as %s', (level, expected) => {
    expect(
      upsertRequestToProto(upsertReq({ durabilityLevel: level }))
        .durability_level
    ).toBe(expected)
  })

  it('should refuse a durability level the SDK does not have', () => {
    expect(() =>
      upsertRequestToProto(
        // @ts-expect-error 5 is not a DurabilityLevel member
        upsertReq({ durabilityLevel: 5 })
      )
    ).toThrow(InvalidDurabilityLevel)
  })

  it.each([{ persistTo: 1 }, { replicateTo: 1 }])(
    'should refuse the legacy durability %j',
    (legacy) => {
      expect(() => upsertRequestToProto(upsertReq(legacy))).toThrow(
        FeatureNotAvailableError
      )
    }
  )

  it('should read the CAS and the mutation token', () => {
    const result = mutationResultFromProto({
      cas: '42',
      mutation_token: {
        bucket_name: 'b',
        vbucket_id: 7,
        vbucket_uuid: '123456789012345',
        seq_no: '99',
      },
    })
    expect(result.cas.toString()).toBe('42')
    expect(result.token?.toString()).toBe('b:7:123456789012345:99')
    expect(
      mutationResultFromProto({ cas: '42', mutation_token: null }).token
    ).toBeUndefined()
  })
})

describe('#couchbase2 kv insert, replace and remove', () => {
  it('should send an insert with an explicit zero expiry', () => {
    const req = insertReq()
    expect(insertRequestToProto(req)).toEqual({
      ...DOCUMENT,
      content_uncompressed: req.value,
      content_flags: req.flags,
      expiry_secs: 0,
    })
    expect(insertRequestToProto(insertReq({ expiry: 60 })).expiry_secs).toBe(60)
  })

  it('should send a replace with its CAS and expiry', () => {
    const req = replaceReq({ cas: new Couchbase2Cas('42'), expiry: 60 })
    expect(replaceRequestToProto(req)).toEqual({
      ...DOCUMENT,
      content_uncompressed: req.value,
      content_flags: req.flags,
      cas: '42',
      expiry_secs: 60,
    })
  })

  it.each([0, 60, 1800000000])(
    'should preserve the expiry on replace by leaving expiry %d out',
    (expiry) => {
      const message = replaceRequestToProto(
        replaceReq({ expiry, preserveExpiry: true })
      )
      expect(message).not.toHaveProperty('expiry_secs')
      expect(message).not.toHaveProperty('expiry_time')
      expect(message).not.toHaveProperty('preserve_expiry_on_existing')
    }
  )

  it('should send a remove with only its document and CAS', () => {
    expect(removeRequestToProto(removeReq())).toEqual(DOCUMENT)
    expect(removeRequestToProto(removeReq({ cas: '7' }))).toEqual({
      ...DOCUMENT,
      cas: '7',
    })
  })

  it.each([
    ['insert', () => insertRequestToProto(insertReq({ persistTo: 1 }))],
    ['replace', () => replaceRequestToProto(replaceReq({ replicateTo: 1 }))],
    ['remove', () => removeRequestToProto(removeReq({ persistTo: 1 }))],
  ])('should refuse legacy durability on %s', (_name, build) => {
    expect(build).toThrow(FeatureNotAvailableError)
  })

  it.each([
    ['insert', insertRequestToProto(insertReq(MAJORITY))],
    ['replace', replaceRequestToProto(replaceReq(MAJORITY))],
    ['remove', removeRequestToProto(removeReq(MAJORITY))],
  ])('should send durability on %s', (_name, message) => {
    expect(message.durability_level).toBe('DURABILITY_LEVEL_MAJORITY')
  })
})

describe('#couchbase2 kv exists, touch and locks', () => {
  const base = { id, timeout: 2500, obs: null }

  it('should send an exists with only its document', () => {
    expect(existsRequestToProto(base)).toEqual(DOCUMENT)
  })

  it('should give a missing document a CAS of zero', () => {
    const found = existsResultFromProto({ result: true, cas: '42' })
    expect(found.exists).toBe(true)
    expect(found.cas?.toString()).toBe('42')
    const missing = existsResultFromProto({ result: false, cas: '0' })
    expect(missing.exists).toBe(false)
    expect(missing.cas?.toString()).toBe('0')
  })

  it.each([
    [0, { expiry_secs: 0 }],
    [60, { expiry_secs: 60 }],
    [30 * 24 * 60 * 60, { expiry_secs: 30 * 24 * 60 * 60 }],
    [1800000000, { expiry_time: { seconds: 1800000000 } }],
  ])('should set a touched expiry %d as %j', (expiry, expected) => {
    expect(touchExpiryToProto(expiry)).toEqual(expected)
  })

  it('should send a touch and a getAndTouch with their expiry', () => {
    expect(touchRequestToProto({ ...base, expiry: 0 })).toEqual({
      ...DOCUMENT,
      expiry_secs: 0,
    })
    expect(
      getAndTouchRequestToProto({ ...base, transcoder, expiry: 60 })
    ).toEqual({ ...DOCUMENT, expiry_secs: 60 })
  })

  it('should send a getAndLock with its lock time', () => {
    expect(
      getAndLockRequestToProto({ ...base, transcoder, lockTime: 15 })
    ).toEqual({ ...DOCUMENT, lock_time_secs: 15 })
  })

  it('should decode a locked document and keep its CAS', () => {
    const [content, flags] = transcoder.encode({ a: 1 })
    const result = lockedOrTouchedResultFromProto(
      {
        content: 'content_uncompressed',
        content_uncompressed: content,
        content_flags: flags,
        cas: '7',
        expiry: { seconds: '1800000000', nanos: 0 },
      },
      { ...base, transcoder },
      'getAndLock'
    )
    expect(result.content).toEqual({ a: 1 })
    expect(result.cas.toString()).toBe('7')
    expect(result.expiryTime).toBeUndefined()
  })

  it('should refuse a touched document without uncompressed content', () => {
    expect(() =>
      lockedOrTouchedResultFromProto(
        {
          content: 'content_compressed',
          content_compressed: Buffer.from('x'),
          content_flags: 0,
          cas: '1',
          expiry: null,
        },
        { ...base, transcoder },
        'getAndTouch'
      )
    ).toThrow(InternalServerFailureError)
  })

  it('should send an unlock with its CAS', () => {
    expect(
      unlockRequestToProto({ ...base, cas: new Couchbase2Cas('42') })
    ).toEqual({ ...DOCUMENT, cas: '42' })
  })

  it.each([
    ['an empty string', ''],
    ['a zero CAS', '0'],
  ])('should refuse an unlock with %s', (_name, cas) => {
    expect(() => unlockRequestToProto({ ...base, cas })).toThrow(
      InvalidArgumentError
    )
  })
})

describe('#couchbase2 kv counters, appends and prepends', () => {
  function counterReq(
    overrides: Partial<KvCounterRequest> = {}
  ): KvCounterRequest {
    return {
      id,
      timeout: 2500,
      obs: null,
      delta: 1,
      expiry: 0,
      durabilityLevel: DurabilityLevel.None,
      ...overrides,
    }
  }

  function appendReq(
    overrides: Partial<KvAppendRequest> = {}
  ): KvAppendRequest {
    return {
      id,
      timeout: 2500,
      obs: null,
      value: Buffer.from('tail'),
      durabilityLevel: DurabilityLevel.None,
      ...overrides,
    }
  }

  it('should send a counter with its delta and an explicit zero expiry', () => {
    expect(counterRequestToProto(counterReq())).toEqual({
      ...DOCUMENT,
      delta: '1',
      expiry_secs: 0,
    })
  })

  it('should send the initial value and expiry when given', () => {
    expect(
      counterRequestToProto(
        counterReq({ delta: BigInt(5), initial: 10, expiry: 1800000000 })
      )
    ).toEqual({
      ...DOCUMENT,
      delta: '5',
      initial: '10',
      expiry_time: { seconds: 1800000000 },
    })
  })

  it.each([
    ['the largest delta', { delta: BigInt('18446744073709551615') }],
    ['the largest initial', { initial: BigInt('9223372036854775807') }],
    ['a zero initial', { initial: 0 }],
  ])('should accept %s', (_name, overrides) => {
    expect(() => counterRequestToProto(counterReq(overrides))).not.toThrow()
  })

  it.each([
    ['a negative delta', { delta: -1 }],
    ['a fractional delta', { delta: 1.5 }],
    ['a delta past 64 bits', { delta: BigInt('18446744073709551616') }],
    ['a NaN delta', { delta: NaN }],
    ['an unsafe number delta', { delta: 2 ** 60 }],
    ['a negative initial', { initial: -1 }],
    ['an initial past int64', { initial: BigInt('9223372036854775808') }],
  ])('should refuse %s', (_name, overrides) => {
    expect(() => counterRequestToProto(counterReq(overrides))).toThrow(
      InvalidArgumentError
    )
  })

  it('should send durability on a counter and refuse the legacy form', () => {
    expect(counterRequestToProto(counterReq(MAJORITY)).durability_level).toBe(
      'DURABILITY_LEVEL_MAJORITY'
    )
    expect(() => counterRequestToProto(counterReq({ persistTo: 1 }))).toThrow(
      FeatureNotAvailableError
    )
  })

  it.each([
    ['5', 5, BigInt(5)],
    ['-1', 2 ** 64, BigInt('18446744073709551615')],
  ])(
    'should read the counter content %s as unsigned',
    (content, value, value64) => {
      const result = counterResultFromProto({
        cas: '42',
        content,
        mutation_token: {
          bucket_name: 'b',
          vbucket_id: 7,
          vbucket_uuid: '123456789012345',
          seq_no: '99',
        },
      })
      expect(result.value).toBe(value)
      expect(result.value64).toBe(value64)
      expect(result.cas.toString()).toBe('42')
      expect(result.token?.toString()).toBe('b:7:123456789012345:99')
    }
  )

  it('should send an append with its bytes and CAS', () => {
    const req = appendReq()
    expect(appendRequestToProto(req)).toEqual({
      ...DOCUMENT,
      content: req.value,
    })
    expect(
      appendRequestToProto(appendReq({ cas: new Couchbase2Cas('42') })).cas
    ).toBe('42')
  })

  it('should send durability on an append and refuse the legacy form', () => {
    expect(appendRequestToProto(appendReq(MAJORITY)).durability_level).toBe(
      'DURABILITY_LEVEL_MAJORITY'
    )
    expect(() => appendRequestToProto(appendReq({ replicateTo: 1 }))).toThrow(
      FeatureNotAvailableError
    )
  })

  it('should send a prepend with the same fields as an append', () => {
    const req: KvPrependRequest = appendReq({
      cas: new Couchbase2Cas('42'),
      ...MAJORITY,
    })
    expect(prependRequestToProto(req)).toEqual(appendRequestToProto(req))
  })
})

describe('#couchbase2 kv sub-document', () => {
  const rpc = loadSchema().google.rpc

  function lookupInReq(
    specs: LookupInSpec[],
    overrides: Partial<KvLookupInRequest> = {}
  ): KvLookupInRequest {
    return {
      id,
      timeout: 2500,
      obs: null,
      specs,
      accessDeleted: false,
      ...overrides,
    }
  }

  function mutateInReq(
    specs: MutateInSpec[],
    overrides: Partial<KvMutateInRequest> = {}
  ): KvMutateInRequest {
    return {
      id,
      timeout: 2500,
      obs: null,
      specs: specs.map((spec) => ({
        spec,
        value: spec._data === undefined ? undefined : Buffer.from(spec._data),
      })),
      expiry: 0,
      preserveExpiry: false,
      durabilityLevel: DurabilityLevel.None,
      ...overrides,
    }
  }

  /**
   * A spec's status as the gateway sends it, with one detail.
   */
  function specStatus(
    code: number,
    detail: { name: string; value: Buffer }
  ): StatusOutputPb {
    return {
      code,
      message: 'refused',
      details: [
        {
          type_url: `type.googleapis.com/google.rpc.${detail.name}`,
          value: detail.value,
        },
      ],
    }
  }

  const PATH_NOT_FOUND = specStatus(5, {
    name: 'ResourceInfo',
    value: rpc.ResourceInfo.serialize({ resource_type: 'path' }),
  })

  const PATH_MISMATCH = specStatus(9, {
    name: 'PreconditionFailure',
    value: rpc.PreconditionFailure.serialize({
      violations: [{ type: 'PATH_MISMATCH' }],
    }),
  })

  it.each([
    ['no xattrs', [false, false, false], [0, 1, 2]],
    ['only xattrs', [true, true], [0, 1]],
    ['xattrs after the body', [false, true, false, true], [1, 3, 0, 2]],
  ])('should send %s first in order', (_name, xattr, order) => {
    expect(xattrsFirst(xattr)).toEqual(order)
  })

  it('should send each lookup-in spec in the order given', () => {
    const req = lookupInReq([
      LookupInSpec.get('a'),
      LookupInSpec.get(''),
      LookupInSpec.exists('x', { xattr: true }),
      LookupInSpec.count('arr'),
    ])
    expect(lookupInRequestToProto(req, [2, 0, 1, 3])).toEqual({
      ...DOCUMENT,
      specs: [
        { operation: 'OPERATION_EXISTS', path: 'x', flags: { xattr: true } },
        { operation: 'OPERATION_GET', path: 'a' },
        { operation: 'OPERATION_GET', path: '' },
        { operation: 'OPERATION_COUNT', path: 'arr' },
      ],
    })
  })

  it('should send accessDeleted as a document flag', () => {
    const req = lookupInReq([LookupInSpec.get('a')], { accessDeleted: true })
    expect(lookupInRequestToProto(req, [0]).flags).toEqual({
      access_deleted: true,
    })
  })

  it('should put the lookup-in answers back in the order written', () => {
    const req = lookupInReq([
      LookupInSpec.get('a'),
      LookupInSpec.get('$document.CAS', { xattr: true }),
      LookupInSpec.count('arr'),
    ])
    const result = lookupInResultFromProto(
      {
        cas: '42',
        specs: [
          { status: null, content: Buffer.from('"0x1"') },
          { status: null, content: Buffer.from('{"b":1}') },
          { status: null, content: Buffer.from('3') },
        ],
      },
      req,
      [1, 0, 2]
    )
    expect(result.cas.toString()).toBe('42')
    expect(result.content.map((entry) => entry.value)).toEqual([
      { b: 1 },
      '0x1',
      3,
    ])
    expect(result.content.every((entry) => entry.status === 'success')).toBe(
      true
    )
  })

  it('should read an exists answer as classic reports it', () => {
    const req = lookupInReq([
      LookupInSpec.exists('there'),
      LookupInSpec.exists('missing'),
    ])
    const result = lookupInResultFromProto(
      {
        cas: '42',
        specs: [
          { status: null, content: Buffer.from('true') },
          { status: null, content: Buffer.from('false') },
        ],
      },
      req,
      [0, 1]
    )
    expect(result.content[0]).toMatchObject({
      error: null,
      value: true,
      status: 'success',
    })
    expect(result.content[1]).toMatchObject({
      error: null,
      value: false,
      status: 'path_not_found',
    })
    expect(result.exists(0)).toBe(true)
    expect(result.exists(1)).toBe(false)
  })

  it('should map a failed lookup-in spec to its error and status', () => {
    const req = lookupInReq([
      LookupInSpec.get('missing'),
      LookupInSpec.get('a.b'),
      LookupInSpec.get('c'),
    ])
    const result = lookupInResultFromProto(
      {
        cas: '42',
        specs: [
          { status: PATH_NOT_FOUND, content: Buffer.alloc(0) },
          { status: PATH_MISMATCH, content: Buffer.alloc(0) },
          {
            status: { code: 3, message: 'bad path', details: [] },
            content: Buffer.alloc(0),
          },
        ],
      },
      req,
      [0, 1, 2]
    )
    expect(result.content[0].error).toBeInstanceOf(PathNotFoundError)
    expect(result.content[0].status).toBe('path_not_found')
    expect(result.content[0].value).toBeUndefined()
    expect(result.exists(0)).toBe(false)

    expect(result.content[1].error).toBeInstanceOf(PathMismatchError)
    expect(result.content[1].status).toBe('path_mismatch')
    expect(() => result.exists(1)).toThrow(PathMismatchError)

    expect(result.content[2].error).toBeInstanceOf(InvalidArgumentError)
    expect(result.content[2].status).toBe('unknown')
  })

  it.each([
    [
      'lookupIn',
      () =>
        lookupInResultFromProto(
          { cas: '42', specs: [] },
          lookupInReq([LookupInSpec.get('a')]),
          [0]
        ),
    ],
    [
      'mutateIn',
      () =>
        mutateInResultFromProto(
          { cas: '42', specs: [], mutation_token: null },
          [0]
        ),
    ],
  ])('should refuse a %s answer missing a spec', (_name, read) => {
    expect(read).toThrow(InternalServerFailureError)
  })

  it('should send each mutate-in spec with its value and flags', () => {
    const req = mutateInReq([
      MutateInSpec.upsert('a', 1, { createPath: true }),
      MutateInSpec.insert('x', 'v', { xattr: true }),
      MutateInSpec.upsert('', { whole: true }),
      MutateInSpec.remove(''),
      MutateInSpec.arrayAppend('arr', [1, 2], { multi: true }),
      MutateInSpec.increment('n', 5),
    ])
    expect(mutateInRequestToProto(req, [1, 0, 2, 3, 4, 5])).toEqual({
      ...DOCUMENT,
      specs: [
        {
          operation: 'OPERATION_INSERT',
          path: 'x',
          content: Buffer.from('"v"'),
          flags: { xattr: true },
        },
        {
          operation: 'OPERATION_UPSERT',
          path: 'a',
          content: Buffer.from('1'),
          flags: { create_path: true },
        },
        {
          operation: 'OPERATION_REPLACE',
          path: '',
          content: Buffer.from('{"whole":true}'),
        },
        { operation: 'OPERATION_REMOVE', path: '' },
        {
          operation: 'OPERATION_ARRAY_APPEND',
          path: 'arr',
          content: Buffer.from('1,2'),
        },
        {
          operation: 'OPERATION_COUNTER',
          path: 'n',
          content: Buffer.from('5'),
        },
      ],
      expiry_secs: 0,
    })
  })

  it('should send the store semantics, CAS, expiry and durability', () => {
    const message = mutateInRequestToProto(
      mutateInReq([MutateInSpec.upsert('a', 1)], {
        storeSemantics: StoreSemantics.Upsert,
        cas: new Couchbase2Cas('42'),
        expiry: 1800000000,
        ...MAJORITY,
      }),
      [0]
    )
    expect(message).toMatchObject({
      store_semantic: 'STORE_SEMANTIC_UPSERT',
      cas: '42',
      expiry_time: { seconds: 1800000000 },
      durability_level: 'DURABILITY_LEVEL_MAJORITY',
    })
  })

  it('should leave the expiry out to preserve it', () => {
    const message = mutateInRequestToProto(
      mutateInReq([MutateInSpec.upsert('a', 1)], { preserveExpiry: true }),
      [0]
    )
    expect(message).not.toHaveProperty('expiry_secs')
    expect(message).not.toHaveProperty('expiry_time')
  })

  it.each([
    [
      'an expiry with preserveExpiry',
      mutateInReq([MutateInSpec.upsert('a', 1)], {
        preserveExpiry: true,
        expiry: 60,
      }),
    ],
    [
      'a mutation macro',
      mutateInReq([MutateInSpec.upsert('m', MutateInMacro.Cas)]),
    ],
    [
      'legacy durability',
      mutateInReq([MutateInSpec.upsert('a', 1)], { persistTo: 1 }),
    ],
  ])('should refuse %s', (_name, req) => {
    expect(() => mutateInRequestToProto(req, [0])).toThrow(
      FeatureNotAvailableError
    )
  })

  it('should refuse unknown store semantics', () => {
    const req = mutateInReq([MutateInSpec.upsert('a', 1)], {
      storeSemantics: 7 as StoreSemantics,
    })
    expect(() => mutateInRequestToProto(req, [0])).toThrow(InvalidArgumentError)
  })

  it('should put the mutate-in answers back in the order written', () => {
    const result = mutateInResultFromProto(
      {
        cas: '42',
        specs: [{ content: Buffer.from('6') }, {}],
        mutation_token: {
          bucket_name: 'b',
          vbucket_id: 7,
          vbucket_uuid: '123456789012345',
          seq_no: '99',
        },
      },
      [1, 0]
    )
    expect(result.content.map((entry) => entry.value)).toEqual([undefined, 6])
    expect(result.cas.toString()).toBe('42')
    expect(result.token?.toString()).toBe('b:7:123456789012345:99')
  })
})

describe('#couchbase2 kv replica reads', () => {
  // Every replica read refuses before it reaches the gateway, so neither
  // the channel nor the client is touched.
  const kv = new Couchbase2Kv({} as Couchbase2KvChannel, {} as KvServiceClient)
  const readReq: KvReplicaReadRequest = {
    id,
    timeout: 2500,
    obs: null,
    transcoder,
  }
  const lookupReq: KvLookupInReplicaRequest = {
    id,
    timeout: 2500,
    obs: null,
    specs: [],
  }

  it.each([
    ['getAnyReplica', () => kv.getAnyReplica(readReq)],
    ['getAllReplicas', () => kv.getAllReplicas(readReq)],
    ['lookupInAnyReplica', () => kv.lookupInAnyReplica(lookupReq)],
    ['lookupInAllReplicas', () => kv.lookupInAllReplicas(lookupReq)],
  ])('should refuse %s as not supported', (name, read) => {
    let err: unknown
    try {
      read()
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(FeatureNotAvailableError)
    expect((err as FeatureNotAvailableError).cause?.message).toBe(
      `${name} is not supported over couchbase2.`
    )
  })
})

describe('#couchbase2 kv scan', () => {
  it('should refuse scan as not supported', () => {
    const kv = new Couchbase2Kv(
      {} as Couchbase2KvChannel,
      {} as KvServiceClient
    )
    const req: KvScanRequest = {
      collection: {} as Collection,
      scanType: new PrefixScan('k'),
      transcoder,
      timeout: 2500,
      idsOnly: false,
      batchByteLimit: 15000,
      batchItemLimit: 50,
      concurrency: 1,
    }
    let err: unknown
    try {
      kv.scan(req)
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(FeatureNotAvailableError)
    expect((err as FeatureNotAvailableError).cause?.message).toBe(
      'scan is not supported over couchbase2.'
    )
  })
})

describe('#couchbase2 kv cas input', () => {
  it.each([
    ['nothing', undefined, undefined],
    ['an empty string', '', undefined],
    ['a zero string', '0', undefined],
    ['a decimal string', '42', '42'],
    ['a leading zero', '042', '42'],
    ['the largest CAS', '18446744073709551615', '18446744073709551615'],
    [
      'a couchbase2 CAS',
      new Couchbase2Cas('1700000000000000001'),
      '1700000000000000001',
    ],
    [
      'a buffer',
      casBytes(BigInt('1700000000000000001')),
      '1700000000000000001',
    ],
    ['a zero buffer', casBytes(BigInt(0)), undefined],
    [
      'a classic CAS',
      {
        raw: casBytes(BigInt('18446744073709551615')),
        toJSON: (): string => '',
      },
      '18446744073709551615',
    ],
  ])('should send %s as %j', (_name, cas, expected) => {
    expect(casToProto(cas)).toBe(expected)
  })

  it.each([
    ['a non-numeric string', 'abc'],
    ['a negative value', '-1'],
    ['a value past 64 bits', '18446744073709551616'],
    ['a short buffer', Buffer.alloc(4)],
  ])('should refuse %s', (_name, cas) => {
    expect(() => casToProto(cas)).toThrow(InvalidArgumentError)
  })
})

describe('#couchbase2 kv values', () => {
  it('should print and serialize a CAS as its decimal value', () => {
    const cas = new Couchbase2Cas('18446744073709551615')
    expect(cas.toString()).toBe('18446744073709551615')
    expect(JSON.stringify({ cas })).toBe('{"cas":"18446744073709551615"}')
    expect(inspect(cas)).toBe('Cas<18446744073709551615>')
  })

  it('should give a mutation token the shape MutationState reads', () => {
    const older = new Couchbase2MutationToken({
      bucket_name: 'b',
      vbucket_id: 7,
      vbucket_uuid: '5',
      seq_no: '10',
    })
    const newer = new Couchbase2MutationToken({
      bucket_name: 'b',
      vbucket_id: 7,
      vbucket_uuid: '5',
      seq_no: '11',
    })
    const state = new MutationState(older, newer)
    expect(state.toJSON()).toEqual({ b: { 7: newer } })
    expect(newer.toJSON()).toEqual({
      bucket_name: 'b',
      partition_id: 7,
      partition_uuid: '5',
      sequence_number: '11',
    })
  })
})
