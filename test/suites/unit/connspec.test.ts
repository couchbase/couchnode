import { describe, expect, it } from 'vitest'

import { PasswordAuthenticator } from '../../../lib/authenticators'
import { ConnSpec } from '../../../lib/connspec'

// Connection-string parsing and stringifying, and the authenticator's SASL
// mechanism defaults. Client side only.
describe('#ConnSpec', () => {
  describe('stringify', () => {
    it('should stringify a connstr spec', () => {
      const x = new ConnSpec({
        scheme: 'https',
        hosts: [
          ['1.1.1.1', 8094],
          ['2.2.2.2', 8099],
        ],
        bucket: 'frank',
        options: {
          joe: 'bob',
          jane: 'drew',
        },
      }).toString()

      expect(x).toBe(
        'https://1.1.1.1:8094,2.2.2.2:8099/frank?joe=bob&jane=drew'
      )
    })

    it('should stringify a connstr spec without a scheme', () => {
      const x = new ConnSpec({
        hosts: [['1.1.1.1', 8094]],
        bucket: 'frank',
        options: { x: 'y' },
      }).toString()
      expect(x).toBe('couchbase://1.1.1.1:8094/frank?x=y')
    })

    it('should stringify a connstr spec without a bucket', () => {
      const x = new ConnSpec({
        scheme: 'http',
        hosts: [['1.1.1.1', 8094]],
        options: { x: 'y' },
      }).toString()
      expect(x).toBe('http://1.1.1.1:8094?x=y')
    })

    it('should stringify a connstr spec without options', () => {
      const x = new ConnSpec({
        scheme: 'http',
        hosts: [['1.1.1.1', 8094]],
        bucket: 'joe',
      }).toString()
      expect(x).toBe('http://1.1.1.1:8094/joe')
    })

    it('should stringify a connstr spec with ipv6 addresses', () => {
      const x = new ConnSpec({
        scheme: 'couchbase',
        hosts: [['[2001:4860:4860::8888]', 8094]],
        bucket: 'joe',
      }).toString()
      expect(x).toBe('couchbase://[2001:4860:4860::8888]:8094/joe')
    })

    it('should correctly stringify a connstr spec with sasl_mech_force', () => {
      const x = new ConnSpec({
        scheme: 'couchbase',
        hosts: [['localhost', 0]],
        bucket: '',
        options: { sasl_mech_force: 'PLAIN' },
      }).toString()
      expect(x).toBe('couchbase://localhost?sasl_mech_force=PLAIN')
    })

    it('should correctly stringify a connstr spec with allowed_sasl_mechanisms', () => {
      const x = new ConnSpec({
        scheme: 'couchbase',
        hosts: [['localhost', 0]],
        bucket: '',
        options: { allowed_sasl_mechanisms: 'PLAIN' },
      }).toString()
      expect(x).toBe('couchbase://localhost?allowed_sasl_mechanisms=PLAIN')
    })
  })

  describe('parse', () => {
    it('should generate a blank spec for a blank string', () => {
      expect(ConnSpec.parse('')).toEqual({
        scheme: 'couchbase',
        hosts: [['localhost', 0]],
        bucket: '',
        options: {},
      })
    })

    it('should not parse a string with no host', () => {
      expect(() => ConnSpec.parse('https:///shirley')).toThrow()
    })

    it('should parse a string with options', () => {
      expect(ConnSpec.parse('http://a/b?c=d&e=f')).toEqual({
        scheme: 'http',
        hosts: [['a', 0]],
        bucket: 'b',
        options: { c: 'd', e: 'f' },
      })
    })

    it('should parse a string with ipv6', () => {
      expect(
        ConnSpec.parse('couchbase://[2001:4860:4860::8888]:9011/b')
      ).toEqual({
        scheme: 'couchbase',
        hosts: [['[2001:4860:4860::8888]', 9011]],
        bucket: 'b',
        options: {},
      })
    })

    it('should parse a string sasl_mech_force in options', () => {
      expect(
        ConnSpec.parse('couchbase://localhost?sasl_mech_force=PLAIN')
      ).toEqual({
        scheme: 'couchbase',
        hosts: [['localhost', 0]],
        bucket: '',
        options: { sasl_mech_force: 'PLAIN' },
      })
    })

    it('should parse a multiple strings in sasl_mech_force in options', () => {
      expect(
        ConnSpec.parse(
          'couchbase://localhost?sasl_mech_force=SCRAM-SHA512&sasl_mech_force=SCRAM-SHA256'
        )
      ).toEqual({
        scheme: 'couchbase',
        hosts: [['localhost', 0]],
        bucket: '',
        options: { sasl_mech_force: ['SCRAM-SHA512', 'SCRAM-SHA256'] },
      })
    })

    it('should parse a string allowed_sasl_mechanisms in options', () => {
      expect(
        ConnSpec.parse('couchbase://localhost?allowed_sasl_mechanisms=PLAIN')
      ).toEqual({
        scheme: 'couchbase',
        hosts: [['localhost', 0]],
        bucket: '',
        options: { allowed_sasl_mechanisms: 'PLAIN' },
      })
    })

    it('should parse a multiple strings in allowed_sasl_mechanisms in options', () => {
      expect(
        ConnSpec.parse(
          'couchbase://localhost?allowed_sasl_mechanisms=SCRAM-SHA512&allowed_sasl_mechanisms=SCRAM-SHA256'
        )
      ).toEqual({
        scheme: 'couchbase',
        hosts: [['localhost', 0]],
        bucket: '',
        options: {
          allowed_sasl_mechanisms: ['SCRAM-SHA512', 'SCRAM-SHA256'],
        },
      })
    })
  })

  describe('#passwordauthenticator', () => {
    it('Should have empty allowed_sasl_mechanisms by default', () => {
      const authenticator = new PasswordAuthenticator('user', 'password')
      expect(authenticator.allowed_sasl_mechanisms).toBeUndefined()
    })

    it('should only enable PLAIN when ldap compatible', () => {
      const authenticator = PasswordAuthenticator.ldapCompatible(
        'user',
        'password'
      )

      expect(authenticator.allowed_sasl_mechanisms).toHaveLength(1)
      expect(authenticator.allowed_sasl_mechanisms?.[0]).toBe('PLAIN')
    })
  })
})
