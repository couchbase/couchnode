import * as grpc from '@grpc/grpc-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { GenericErrorContext } from '../../../../lib/errorcontexts'
import {
  AmbiguousTimeoutError,
  AuthenticationFailureError,
  AuthorizationFailureError,
  BucketExistsError,
  CasMismatchError,
  CollectionNotFoundError,
  CouchbaseError,
  DocumentExistsError,
  DocumentLockedError,
  DocumentTooDeepError,
  DocumentNotFoundError,
  FeatureNotAvailableError,
  IndexNotFoundError,
  InternalServerFailureError,
  InvalidArgumentError,
  PathNotFoundError,
  PathTooDeepError,
  RequestCanceledError,
  ServiceNotAvailableError,
  UnambiguousTimeoutError,
} from '../../../../lib/errors'
import {
  errorFromMapped,
  isServiceError,
  mapServiceError,
  mapStatus,
  RequestErrorFields,
} from '../../../../lib/couchbase2/errormapping'
import { loadSchema } from '../../../../lib/couchbase2/schema'
import {
  readStatusDetails,
  STATUS_DETAILS_KEY,
  StatusDetails,
} from '../../../../lib/couchbase2/statusdetails'

const rpc = loadSchema().google.rpc

const REQUEST: RequestErrorFields = {
  last_dispatched_to: 'h:18098',
  last_dispatched_from: '',
  retry_attempts: 2,
  retry_reasons: ['service_not_available'],
  last_error: 'ServiceNotAvailableError, caused by unavailable',
}

interface Detail {
  name: string
  value: Buffer
}

function resourceInfo(resource_type: string, resource_name = 'n'): Detail {
  return {
    name: 'ResourceInfo',
    value: rpc.ResourceInfo.serialize({ resource_type, resource_name }),
  }
}

function violation(type: string): Detail {
  return {
    name: 'PreconditionFailure',
    value: rpc.PreconditionFailure.serialize({ violations: [{ type }] }),
  }
}

function errorInfo(reason: string): Detail {
  return { name: 'ErrorInfo', value: rpc.ErrorInfo.serialize({ reason }) }
}

function statusBytes(
  code: grpc.status,
  message: string,
  details: Detail[]
): Buffer {
  return rpc.Status.serialize({
    code,
    message,
    details: details.map((d) => ({
      type_url: `type.googleapis.com/google.rpc.${d.name}`,
      value: d.value,
    })),
  })
}

function trailer(payload: Buffer | string): grpc.Metadata {
  const metadata = new grpc.Metadata()
  if (typeof payload === 'string') {
    metadata.set('x-other', payload)
  } else {
    metadata.set(STATUS_DETAILS_KEY, payload)
  }
  return metadata
}

function serviceError(
  code: grpc.status,
  details: string,
  metadata = new grpc.Metadata()
): grpc.ServiceError {
  return Object.assign(new Error(`${code} ${grpc.status[code]}: ${details}`), {
    code,
    details,
    metadata,
  })
}

function mapped(
  code: grpc.status,
  details: Detail[] = [],
  readOnly = false
): CouchbaseError {
  const metadata = trailer(statusBytes(code, 'from the status', details))
  return errorFromMapped(
    mapServiceError(serviceError(code, 'bare', metadata), readOnly),
    REQUEST
  )
}

function bare(code: grpc.status, readOnly = false): CouchbaseError {
  return errorFromMapped(mapStatus(code, 'bare', undefined, readOnly), REQUEST)
}

// Decoding the grpc-status-details-bin trailer. No server.
describe('#couchbase2 status details', () => {
  it('should read nothing without the trailer', () => {
    expect(readStatusDetails(grpc.status.NOT_FOUND, undefined)).toBeUndefined()
    expect(
      readStatusDetails(grpc.status.NOT_FOUND, trailer('x'))
    ).toBeUndefined()
  })

  it('should read nothing from a trailer that does not decode', () => {
    const garbage = Buffer.from([0xff, 0xff, 0xff, 0xff])
    expect(
      readStatusDetails(grpc.status.NOT_FOUND, trailer(garbage))
    ).toBeUndefined()
  })

  it('should read nothing from a trailer for another code', () => {
    const payload = statusBytes(grpc.status.ABORTED, 'm', [])
    expect(
      readStatusDetails(grpc.status.NOT_FOUND, trailer(payload))
    ).toBeUndefined()
  })

  it('should read the message and the first detail of each type', () => {
    const payload = statusBytes(grpc.status.NOT_FOUND, 'gone', [
      resourceInfo('collection', 'first'),
      resourceInfo('scope', 'second'),
      errorInfo('WHY'),
    ])
    const details = readStatusDetails(grpc.status.NOT_FOUND, trailer(payload))
    expect(details?.message).toBe('gone')
    expect(details?.resourceInfo?.resource_type).toBe('collection')
    expect(details?.resourceInfo?.resource_name).toBe('first')
    expect(details?.errorInfo?.reason).toBe('WHY')
    expect(details?.preconditionFailure).toBeUndefined()
  })

  it('should skip a detail of an unknown type', () => {
    const payload = rpc.Status.serialize({
      code: grpc.status.NOT_FOUND,
      details: [
        { type_url: 'type.googleapis.com/x.Unknown', value: Buffer.from('?') },
      ],
    })
    const details = readStatusDetails(grpc.status.NOT_FOUND, trailer(payload))
    expect(details?.message).toBe('')
    expect(details?.resourceInfo).toBeUndefined()
  })

  it('should leave out a detail that does not decode', () => {
    const payload = statusBytes(grpc.status.NOT_FOUND, 'm', [
      { name: 'ResourceInfo', value: Buffer.from([0xff, 0xff, 0xff]) },
    ])
    const details = readStatusDetails(grpc.status.NOT_FOUND, trailer(payload))
    expect(details?.message).toBe('m')
    expect(details?.resourceInfo).toBeUndefined()
  })
})

// Status code and details to SDK error, and the retry reason. No server.
describe('#couchbase2 error mapping', () => {
  it.each([
    ['document', DocumentNotFoundError],
    ['collection', CollectionNotFoundError],
    ['queryindex', IndexNotFoundError],
    ['searchindex', IndexNotFoundError],
    ['path', PathNotFoundError],
  ])('should map NOT_FOUND on %s', (type, cls) => {
    expect(mapped(grpc.status.NOT_FOUND, [resourceInfo(type)])).toBeInstanceOf(
      cls
    )
  })

  it.each([
    [grpc.status.NOT_FOUND, 'unheard of'],
    [grpc.status.NOT_FOUND, 'constructor'],
    [grpc.status.ALREADY_EXISTS, 'unheard of'],
    [grpc.status.ALREADY_EXISTS, 'toString'],
  ])(
    'should map code %i on an unknown resource type %s to a plain CouchbaseError',
    (code, type) => {
      const err = mapped(code, [resourceInfo(type)])
      expect(err.constructor).toBe(CouchbaseError)
      expect(err.message).toBe('from the status')
    }
  )

  it.each([grpc.status.NOT_FOUND, grpc.status.ALREADY_EXISTS])(
    'should map code %i without a resource to a plain CouchbaseError',
    (code) => {
      expect(bare(code).constructor).toBe(CouchbaseError)
    }
  )

  it('should map ALREADY_EXISTS by resource type', () => {
    expect(
      mapped(grpc.status.ALREADY_EXISTS, [resourceInfo('bucket')])
    ).toBeInstanceOf(BucketExistsError)
    expect(
      mapped(grpc.status.ALREADY_EXISTS, [resourceInfo('document')])
    ).toBeInstanceOf(DocumentExistsError)
  })

  it('should map ABORTED on CAS_MISMATCH and nothing else', () => {
    const cas = mapped(grpc.status.ABORTED, [errorInfo('CAS_MISMATCH')])
    expect(cas).toBeInstanceOf(CasMismatchError)
    expect((cas.context as GenericErrorContext).reason).toBe('CAS_MISMATCH')

    const other = mapped(grpc.status.ABORTED, [errorInfo('OTHER')])
    expect(other.constructor).toBe(CouchbaseError)
    expect(other.message).toBe('from the status')
  })

  it('should map a precondition violation, and retry LOCKED', () => {
    const locked = mapServiceError(
      serviceError(
        grpc.status.FAILED_PRECONDITION,
        'bare',
        trailer(
          statusBytes(grpc.status.FAILED_PRECONDITION, 'm', [
            violation('LOCKED'),
          ])
        )
      ),
      false
    )
    expect(locked.retryReason).toBe('key_value_locked')
    expect(errorFromMapped(locked, REQUEST)).toBeInstanceOf(DocumentLockedError)

    const deep = mapped(grpc.status.FAILED_PRECONDITION, [
      violation('DOC_TOO_DEEP'),
    ])
    expect(deep).toBeInstanceOf(DocumentTooDeepError)
    expect(deep).not.toBeInstanceOf(PathTooDeepError)
    expect((deep.context as GenericErrorContext).precondition_violation).toBe(
      'DOC_TOO_DEEP'
    )
  })

  it('should map an unknown or missing violation to a plain CouchbaseError', () => {
    for (const type of ['POISONED_CAS', 'constructor']) {
      expect(
        mapped(grpc.status.FAILED_PRECONDITION, [violation(type)]).constructor
      ).toBe(CouchbaseError)
    }
    expect(bare(grpc.status.FAILED_PRECONDITION).constructor).toBe(
      CouchbaseError
    )
  })

  it('should keep a violation and a reason in the context under any code', () => {
    const err = mapped(grpc.status.INTERNAL, [
      violation('LOCKED'),
      errorInfo('CAS_MISMATCH'),
    ])
    expect(err).toBeInstanceOf(InternalServerFailureError)
    const ctx = err.context as GenericErrorContext
    expect(ctx.precondition_violation).toBe('LOCKED')
    expect(ctx.reason).toBe('CAS_MISMATCH')
  })

  it('should retry LOCKED only on FAILED_PRECONDITION', () => {
    for (const code of [grpc.status.ABORTED, grpc.status.INTERNAL]) {
      const details: StatusDetails = {
        message: 'm',
        preconditionFailure: {
          violations: [{ type: 'LOCKED', subject: '', description: '' }],
        },
      }
      expect(mapStatus(code, '', details, false).retryReason).toBeUndefined()
    }
  })

  it('should separate authentication from authorization', () => {
    expect(bare(grpc.status.PERMISSION_DENIED)).not.toBeInstanceOf(
      AuthorizationFailureError
    )
    expect(bare(grpc.status.PERMISSION_DENIED)).toBeInstanceOf(
      AuthenticationFailureError
    )
    expect(
      mapped(grpc.status.PERMISSION_DENIED, [resourceInfo('user')])
    ).not.toBeInstanceOf(AuthorizationFailureError)

    const denied = mapped(grpc.status.PERMISSION_DENIED, [
      resourceInfo('collection'),
    ])
    expect(denied).toBeInstanceOf(AuthorizationFailureError)
    expect(denied).toBeInstanceOf(AuthenticationFailureError)
    expect(denied.name).toBe('AuthorizationFailureError')
    expect(denied.message).toBe('authorization failure')
  })

  it('should make a deadline ambiguous only for a write', () => {
    expect(bare(grpc.status.DEADLINE_EXCEEDED, true)).toBeInstanceOf(
      UnambiguousTimeoutError
    )
    expect(bare(grpc.status.DEADLINE_EXCEEDED, false)).toBeInstanceOf(
      AmbiguousTimeoutError
    )
  })

  it.each([
    [grpc.status.INVALID_ARGUMENT, InvalidArgumentError],
    [grpc.status.OUT_OF_RANGE, InvalidArgumentError],
    [grpc.status.UNIMPLEMENTED, FeatureNotAvailableError],
    [grpc.status.UNAUTHENTICATED, AuthenticationFailureError],
    [grpc.status.CANCELLED, RequestCanceledError],
    [grpc.status.UNAVAILABLE, ServiceNotAvailableError],
    [grpc.status.INTERNAL, InternalServerFailureError],
  ])('should map code %i by code alone', (code, cls) => {
    expect(bare(code)).toBeInstanceOf(cls)
  })

  it('should map RESOURCE_EXHAUSTED to a plain CouchbaseError', () => {
    expect(bare(grpc.status.RESOURCE_EXHAUSTED).constructor).toBe(
      CouchbaseError
    )
  })

  it('should map any other code to a plain CouchbaseError', () => {
    const err = bare(grpc.status.DATA_LOSS)
    expect(err.constructor).toBe(CouchbaseError)
    expect(err.message).toBe('bare')
    expect(
      errorFromMapped(
        mapStatus(grpc.status.DATA_LOSS, '', undefined, false),
        REQUEST
      ).message
    ).toBe('gRPC status DATA_LOSS')
  })

  it.each([
    [
      grpc.status.NOT_FOUND,
      [resourceInfo('widget')],
      'NOT_FOUND resource type "widget"',
    ],
    [
      grpc.status.ALREADY_EXISTS,
      [resourceInfo('widget')],
      'ALREADY_EXISTS resource type "widget"',
    ],
    [
      grpc.status.FAILED_PRECONDITION,
      [violation('POISONED_CAS')],
      'precondition violation "POISONED_CAS"',
    ],
    [
      grpc.status.FAILED_PRECONDITION,
      [violation('constructor')],
      'precondition violation "constructor"',
    ],
    [grpc.status.ABORTED, [errorInfo('OTHER')], 'ABORTED reason "OTHER"'],
    [grpc.status.DATA_LOSS, [], 'gRPC status DATA_LOSS'],
    [grpc.status.RESOURCE_EXHAUSTED, [], 'gRPC status RESOURCE_EXHAUSTED'],
  ])(
    'should name what it does not recognize for code %i',
    (code, details, value) => {
      expect(
        mapServiceError(
          serviceError(code, 'bare', trailer(statusBytes(code, 'm', details))),
          false
        ).unrecognized
      ).toBe(value)
    }
  )

  it.each([
    [grpc.status.NOT_FOUND, [resourceInfo('bucket')]],
    [grpc.status.NOT_FOUND, []],
    [grpc.status.FAILED_PRECONDITION, [violation('LOCKED')]],
    [grpc.status.FAILED_PRECONDITION, []],
    [grpc.status.ABORTED, [errorInfo('CAS_MISMATCH')]],
    [grpc.status.ABORTED, []],
    [grpc.status.PERMISSION_DENIED, [resourceInfo('widget')]],
    [grpc.status.UNAVAILABLE, []],
    [grpc.status.UNKNOWN, []],
  ])('should recognize code %i with %j', (code, details) => {
    expect(
      mapServiceError(
        serviceError(code, 'bare', trailer(statusBytes(code, 'm', details))),
        false
      )
    ).not.toHaveProperty('unrecognized')
  })

  it('should retry UNAVAILABLE and nothing else by code', () => {
    expect(
      mapStatus(grpc.status.UNAVAILABLE, '', undefined, false).retryReason
    ).toBe('service_not_available')
    for (const code of [
      grpc.status.INTERNAL,
      grpc.status.DEADLINE_EXCEEDED,
      grpc.status.ABORTED,
    ]) {
      expect(mapStatus(code, '', undefined, false).retryReason).toBeUndefined()
    }
  })

  it('should map something that is not a failed call as UNKNOWN', () => {
    expect(isServiceError(new Error('x'))).toBe(false)
    const m = mapServiceError(new TypeError('cannot serialize'), true)
    expect(m.fields.status_code).toBe(grpc.status.UNKNOWN)
    expect(m.fields.message).toBe('cannot serialize')
    expect(m.errorClass).toBeUndefined()
  })

  it('should fill the context from the details and the request', () => {
    const details: StatusDetails = {
      message: 'the status message',
      resourceInfo: {
        resource_type: 'document',
        resource_name: 'b/s/c/k',
        owner: '',
        description: '',
      },
      debugInfo: { detail: 'd', stack_entries: ['a', 'b'] },
      requestInfo: { request_id: 'r1', serving_data: 's' },
    }
    const err = errorFromMapped(
      mapStatus(grpc.status.NOT_FOUND, 'bare', details, true),
      REQUEST
    )
    expect(err).toBeInstanceOf(DocumentNotFoundError)
    expect(err.cause).toBeUndefined()

    const ctx = err.context as GenericErrorContext
    expect(ctx).toBeInstanceOf(GenericErrorContext)
    expect(ctx).toEqual({
      ...REQUEST,
      message: 'the status message',
      status_code: grpc.status.NOT_FOUND,
      precondition_violation: undefined,
      resource_name: 'b/s/c/k',
      resource_type: 'document',
      reason: undefined,
      debug_info: { detail: 'd', stack_entries: ['a', 'b'] },
      request_info: { request_id: 'r1', serving_data: 's' },
    })
  })

  it('should prefer the bare message when the status has none', () => {
    const err = bare(grpc.status.INTERNAL)
    expect((err.context as GenericErrorContext).message).toBe('bare')
  })
})

// The trailer as grpc-js delivers it from a real call.
describe('#couchbase2 error mapping over a call', () => {
  let server: grpc.Server
  let target: string

  beforeAll(async () => {
    server = new grpc.Server()
    server.addService(loadSchema().grpc.health.v1.Health.service, {
      Check: (_call: unknown, callback: grpc.sendUnaryData<unknown>) => {
        callback({
          code: grpc.status.NOT_FOUND,
          details: 'bare',
          metadata: trailer(
            statusBytes(grpc.status.NOT_FOUND, 'collection gone', [
              resourceInfo('collection', 'b/s/c'),
            ])
          ),
        })
      },
    })
    const port = await new Promise<number>((resolve, reject) =>
      server.bindAsync(
        '127.0.0.1:0',
        grpc.ServerCredentials.createInsecure(),
        (err, p) => (err ? reject(err) : resolve(p))
      )
    )
    target = `127.0.0.1:${port}`
  })

  afterAll(() => {
    server.forceShutdown()
  })

  it('should map the status details the server sent', async () => {
    const Health = loadSchema().grpc.health.v1.Health
    const client = new Health(target, grpc.credentials.createInsecure())
    try {
      const err = await new Promise<unknown>((resolve) =>
        client.Check({}, (e) => resolve(e))
      )
      expect(isServiceError(err)).toBe(true)

      const mappedErr = errorFromMapped(mapServiceError(err, true), REQUEST)
      expect(mappedErr).toBeInstanceOf(CollectionNotFoundError)
      const ctx = mappedErr.context as GenericErrorContext
      expect(ctx.message).toBe('collection gone')
      expect(ctx.resource_name).toBe('b/s/c')
    } finally {
      client.close()
    }
  })
})
