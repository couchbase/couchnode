import { describe, expect, it } from 'vitest'

import { DEFAULT_PORT, parseConnStr } from '../../../../lib/couchbase2/connstr'
import { InvalidArgumentError } from '../../../../lib/errors'

// What a couchbase2:// connection string may say, and what it is refused
// for. Client side only.
describe('#couchbase2 connstr', () => {
  it.each([
    ['couchbase2://gateway', 'gateway', DEFAULT_PORT],
    ['couchbase2://gateway:1234', 'gateway', 1234],
    ['couchbase2://gateway/', 'gateway', DEFAULT_PORT],
    ['couchbase2://10.0.0.1:18099', '10.0.0.1', 18099],
    ['couchbase2://[::1]', '[::1]', DEFAULT_PORT],
    ['couchbase2://[::1]:443', '[::1]', 443],
  ])('should read the one gateway in %s', (connStr, host, port) => {
    const parsed = parseConnStr(connStr)
    expect(parsed.host).toBe(host)
    expect(parsed.port).toBe(port)
    expect(parsed.target).toBe(`${host}:${port}`)
  })

  it('should default to verifying with the Mozilla roots', () => {
    const parsed = parseConnStr('couchbase2://gateway')
    expect(parsed.tlsVerify).toBe('peer')
    expect(parsed.trustCertificate).toBeUndefined()
    expect(parsed.disableMozillaCaCertificates).toBe(false)
    expect(parsed.logRedaction).toBe(false)
    expect(parsed.ignoredOptions).toEqual([])
    expect(parsed.warnings).toEqual([])
  })

  it.each([
    ['couchbase://gateway', 'couchbase2://'],
    ['couchbase2://a,b', 'one host'],
    ['couchbase2://a;b', 'one host'],
    ['couchbase2://user:pass@gateway', 'authenticator'],
    ['couchbase2://gateway/default', 'no bucket'],
    ['couchbase2://gateway:70000', 'invalid port'],
    ['couchbase2://', 'names no host'],
  ])('should refuse %s', (connStr, message) => {
    let err: unknown
    try {
      parseConnStr(connStr)
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(InvalidArgumentError)
    expect((err as InvalidArgumentError).cause?.message).toContain(message)
  })

  it('should read tls_verify', () => {
    expect(parseConnStr('couchbase2://g?tls_verify=none').tlsVerify).toBe(
      'none'
    )
    expect(parseConnStr('couchbase2://g?tls_verify=peer').tlsVerify).toBe(
      'peer'
    )
  })

  it.each(['true', 'yes', 'on'])(
    'should read disable_mozilla_ca_certificates=%s as true',
    (value) => {
      const parsed = parseConnStr(
        `couchbase2://g?disable_mozilla_ca_certificates=${value}`
      )
      expect(parsed.disableMozillaCaCertificates).toBe(true)
    }
  )

  it.each([
    ['true', true],
    ['on', true],
    ['false', false],
    ['no', false],
  ])('should read log_redaction=%s as %s', (value, expected) => {
    expect(
      parseConnStr(`couchbase2://g?log_redaction=${value}`).logRedaction
    ).toBe(expected)
  })

  it('should keep the default and warn on a value it cannot read', () => {
    const parsed = parseConnStr(
      'couchbase2://g?tls_verify=maybe&disable_mozilla_ca_certificates=2' +
        '&log_redaction=sometimes'
    )
    expect(parsed.tlsVerify).toBe('peer')
    expect(parsed.disableMozillaCaCertificates).toBe(false)
    expect(parsed.logRedaction).toBe(false)
    expect(parsed.warnings).toHaveLength(3)
    expect(parsed.warnings[0]).toContain('tls_verify')
    expect(parsed.warnings[1]).toContain('disable_mozilla_ca_certificates')
    expect(parsed.warnings[2]).toContain('log_redaction')
  })

  it('should take trust_certificate over the legacy trust_store_path', () => {
    expect(
      parseConnStr('couchbase2://g?trust_store_path=/legacy.pem')
        .trustCertificate
    ).toBe('/legacy.pem')
    expect(
      parseConnStr(
        'couchbase2://g?trust_store_path=/legacy.pem&trust_certificate=/ca.pem'
      ).trustCertificate
    ).toBe('/ca.pem')
  })

  it('should take the last value of a repeated option', () => {
    expect(
      parseConnStr('couchbase2://g?tls_verify=none&tls_verify=peer').tlsVerify
    ).toBe('peer')
  })

  it('should name the options a couchbase2 connection does not use', () => {
    const parsed = parseConnStr(
      'couchbase2://g?kv_timeout=10&enable_dns_srv=false&tls_verify=none'
    )
    expect(parsed.ignoredOptions).toEqual(['kv_timeout', 'enable_dns_srv'])
  })
})
