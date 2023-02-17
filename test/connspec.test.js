'use strict'

const assert = require('chai').assert
var { ConnSpec } = require('../lib/connspec')

const harness = require('./harness')

const H = harness

describe('#ConnSpec', function () {
  describe('stringify', function () {
    it('should stringify a connstr spec', function () {
      var x = new ConnSpec({
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

      assert.equal(
        x,
        'https://1.1.1.1:8094,2.2.2.2:8099/frank?joe=bob&jane=drew'
      )
    })

    it('should stringify a connstr spec without a scheme', function () {
      var x = new ConnSpec({
        hosts: [['1.1.1.1', 8094]],
        bucket: 'frank',
        options: {
          x: 'y',
        },
      }).toString()
      assert.equal(x, 'couchbase://1.1.1.1:8094/frank?x=y')
    })

    it('should stringify a connstr spec without a bucket', function () {
      var x = new ConnSpec({
        scheme: 'http',
        hosts: [['1.1.1.1', 8094]],
        options: {
          x: 'y',
        },
      }).toString()
      assert.equal(x, 'http://1.1.1.1:8094?x=y')
    })

    it('should stringify a connstr spec without options', function () {
      var x = new ConnSpec({
        scheme: 'http',
        hosts: [['1.1.1.1', 8094]],
        bucket: 'joe',
      }).toString()
      assert.equal(x, 'http://1.1.1.1:8094/joe')
    })

    it('should stringify a connstr spec with ipv6 addresses', function () {
      var x = new ConnSpec({
        scheme: 'couchbase',
        hosts: [['[2001:4860:4860::8888]', 8094]],
        bucket: 'joe',
      }).toString()
      assert.equal(x, 'couchbase://[2001:4860:4860::8888]:8094/joe')
    })

    it('should correctly stringify a connstr spec with sasl_mech_force', function () {
      var x = new ConnSpec({
        scheme: 'couchbase',
        hosts: [['localhost', 0]],
        bucket: '',
        options: {
          sasl_mech_force: 'PLAIN',
        },
      }).toString()
      assert.equal(x, 'couchbase://localhost?sasl_mech_force=PLAIN')
    })

    it('should correctly stringify a connstr spec with allowed_sasl_mechanisms', function () {
      var x = new ConnSpec({
        scheme: 'couchbase',
        hosts: [['localhost', 0]],
        bucket: '',
        options: {
          allowed_sasl_mechanisms: 'PLAIN',
        },
      }).toString()
      assert.equal(x, 'couchbase://localhost?allowed_sasl_mechanisms=PLAIN')
    })
  })

  describe('parse', function () {
    it('should generate a blank spec for a blank string', function () {
      var x = ConnSpec.parse('')
      assert.deepEqual(x, {
        scheme: 'couchbase',
        hosts: [['localhost', 0]],
        bucket: '',
        options: {},
      })
    })

    it('should not parse a string with no host', function () {
      assert.throws(() => {
        ConnSpec.parse('https:///shirley')
      })
    })

    it('should parse a string with options', function () {
      var x = ConnSpec.parse('http://a/b?c=d&e=f')
      assert.deepEqual(x, {
        scheme: 'http',
        hosts: [['a', 0]],
        bucket: 'b',
        options: {
          c: 'd',
          e: 'f',
        },
      })
    })

    it('should parse a string with ipv6', function () {
      var x = ConnSpec.parse('couchbase://[2001:4860:4860::8888]:9011/b')
      assert.deepEqual(x, {
        scheme: 'couchbase',
        hosts: [['[2001:4860:4860::8888]', 9011]],
        bucket: 'b',
        options: {},
      })
    })

    it('should parse a string sasl_mech_force in options', function () {
      var x = ConnSpec.parse('couchbase://localhost?sasl_mech_force=PLAIN')
      assert.deepEqual(x, {
        scheme: 'couchbase',
        hosts: [['localhost', 0]],
        bucket: '',
        options: {
          sasl_mech_force: 'PLAIN',
        },
      })
    })

    it('should parse a multiple strings in sasl_mech_force in options', function () {
      var x = ConnSpec.parse(
        'couchbase://localhost?sasl_mech_force=SCRAM-SHA512&sasl_mech_force=SCRAM-SHA256'
      )
      assert.deepEqual(x, {
        scheme: 'couchbase',
        hosts: [['localhost', 0]],
        bucket: '',
        options: {
          sasl_mech_force: ['SCRAM-SHA512', 'SCRAM-SHA256'],
        },
      })
    })

    it('should parse a string allowed_sasl_mechanisms in options', function () {
      var x = ConnSpec.parse(
        'couchbase://localhost?allowed_sasl_mechanisms=PLAIN'
      )
      assert.deepEqual(x, {
        scheme: 'couchbase',
        hosts: [['localhost', 0]],
        bucket: '',
        options: {
          allowed_sasl_mechanisms: 'PLAIN',
        },
      })
    })

    it('should parse a multiple strings in allowed_sasl_mechanisms in options', function () {
      var x = ConnSpec.parse(
        'couchbase://localhost?allowed_sasl_mechanisms=SCRAM-SHA512&allowed_sasl_mechanisms=SCRAM-SHA256'
      )
      assert.deepEqual(x, {
        scheme: 'couchbase',
        hosts: [['localhost', 0]],
        bucket: '',
        options: {
          allowed_sasl_mechanisms: ['SCRAM-SHA512', 'SCRAM-SHA256'],
        },
      })
    })
  })

  describe('#passwordauthenticator', function () {
    it('Should have empty allowed_sasl_mechanisms by default', async function () {
      const authenticator = new H.lib.PasswordAuthenticator('user', 'password')
      assert.isUndefined(authenticator.allowed_sasl_mechanisms)
    })

    it('should only enable PLAIN when ldap compatible', async function () {
      const authenticator = H.lib.PasswordAuthenticator.ldapCompatible(
        'user',
        'password'
      )

      assert.strictEqual(1, authenticator.allowed_sasl_mechanisms.length)
      assert.strictEqual('PLAIN', authenticator.allowed_sasl_mechanisms[0])
    })
  })
})
