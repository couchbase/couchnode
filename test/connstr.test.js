'use strict'

var assert = require('assert')
var connstr = require('../lib/connstr')

describe('#ConnStr', function () {
  describe('normalize', function () {
    it('should use sensible default scheme', function () {
      var x = connstr._normalize({})
      assert.equal(x.scheme, 'http')
    })

    it('should break apart string hosts', function () {
      var x = connstr._normalize({
        hosts: 'localhost',
      })
      assert.deepEqual(x.hosts, [['localhost', 0]])
    })

    it('should break apart string hosts with a port', function () {
      var x = connstr._normalize({
        hosts: 'localhost:8091',
      })
      assert.deepEqual(x.hosts, [['localhost', 8091]])
    })

    it('should normalize strings', function () {
      var x = connstr.normalize('localhost')
      assert.equal(x, 'http://localhost')
    })

    it('should work with array options', function () {
      var x = connstr.normalize('http://test?opt=1&opt=2')
      assert.equal(x, 'http://test?opt=1&opt=2')
    })
  })

  describe('stringify', function () {
    it('should stringify a connstr spec', function () {
      var x = connstr._stringify({
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
      })
      assert.equal(
        x,
        'https://1.1.1.1:8094,2.2.2.2:8099/frank?joe=bob&jane=drew'
      )
    })

    it('should stringify a connstr spec without a scheme', function () {
      var x = connstr._stringify({
        hosts: [['1.1.1.1', 8094]],
        bucket: 'frank',
        options: {
          x: 'y',
        },
      })
      assert.equal(x, '1.1.1.1:8094/frank?x=y')
    })

    it('should stringify a connstr spec without a bucket', function () {
      var x = connstr._stringify({
        scheme: 'http',
        hosts: [['1.1.1.1', 8094]],
        options: {
          x: 'y',
        },
      })
      assert.equal(x, 'http://1.1.1.1:8094?x=y')
    })

    it('should stringify a connstr spec without options', function () {
      var x = connstr._stringify({
        scheme: 'http',
        hosts: [['1.1.1.1', 8094]],
        bucket: 'joe',
      })
      assert.equal(x, 'http://1.1.1.1:8094/joe')
    })

    it('should stringify a connstr spec with ipv6 addresses', function () {
      var x = connstr._stringify({
        scheme: 'couchbase',
        hosts: [['[2001:4860:4860::8888]', 8094]],
        bucket: 'joe',
      })
      assert.equal(x, 'couchbase://[2001:4860:4860::8888]:8094/joe')
    })
  })

  describe('parse', function () {
    it('should generate a blank spec for a blank string', function () {
      var x = connstr.parse(null)
      assert.deepEqual(x, {
        scheme: 'http',
        hosts: [],
        bucket: '',
        options: {},
      })
    })

    it('should parse a string with no host', function () {
      var x = connstr.parse('https:///shirley')
      assert.deepEqual(x, {
        scheme: 'https',
        hosts: [],
        bucket: 'shirley',
        options: {},
      })
    })

    it('should parse a string with options', function () {
      var x = connstr.parse('http:///b?c=d&e=f')
      assert.deepEqual(x, {
        scheme: 'http',
        hosts: [],
        bucket: 'b',
        options: {
          c: 'd',
          e: 'f',
        },
      })
    })

    it('should parse a string with ipv6', function () {
      var x = connstr.parse('couchbase://[2001:4860:4860::8888]:9011/b')
      assert.deepEqual(x, {
        scheme: 'couchbase',
        hosts: [['[2001:4860:4860::8888]', 9011]],
        bucket: 'b',
        options: {},
      })
    })
  })
})
