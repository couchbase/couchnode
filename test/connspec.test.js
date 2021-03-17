'use strict'

var assert = require('assert')
var { ConnSpec } = require('../lib/connspec')

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
  })
})
