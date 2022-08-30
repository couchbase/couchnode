'use strict'

const assert = require('chai').assert
const harness = require('./harness')

const H = harness

describe('#passwordauthenticator', function() {
    it('should only enable PLAIN when ldap compatible', async function() {

        var authenticator = H.lib.PasswordAuthenticator.ldapCompatible('user', 'password')

        assert.strictEqual(1, authenticator.allowed_sasl_mechanisms.length)
        assert.strictEqual('PLAIN', authenticator.allowed_sasl_mechanisms[0])

        authenticator = new H.lib.PasswordAuthenticator('user', 'password')
        assert.isNotTrue(authenticator.allowed_sasl_mechanisms.includes('PLAIN'))
    })
})