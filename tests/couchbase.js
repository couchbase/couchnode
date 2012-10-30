var should  = require('should')
  , assert = require('assert')
  , couchbase = require('../lib/couchbase')
  , fs = require('fs')

var config = JSON.parse(fs.readFileSync('./tests/config.json'))

helper = function(callback) {
  couchbase.connect(config, callback)
}

var testValue = {
  'type': 'test',
  'hello': 'world',
  'awesome': 'couchbase'
}

// keys for multiget
keys = ["key0", "key1", "key2", "key3", "key4", "key5", "key6", "key7", "key8", "key9"]
vals = ["val0", "val1", "val2", "val3", "val4", "val5", "val6", "val7", "key8", "key9"]

describe('couchbase', function() {

  describe('SET', function() {
    it('should set a key-value pair', function(done) {
      helper(function(error, cb) {
        cb.set('foo', 'bar', function(error, meta) {
          error.should.equal(false)
          meta.id.should.equal('foo')
          done()
        })
      })
    })
    
    it('should set a json key', function(done) {
      helper(function(error, cb) {
        cb.set('foo2', testValue, function(error, meta) {
          error.should.equal(false)
          meta.id.should.equal('foo2')
          done()
        })
      })
    })
  })
  
  describe('GET', function() {
    it('should get key-value pair', function(done) {
      helper(function(error, cb) {
        cb.get('foo', function(error, data, meta) {
          error.should.equal(false)
          data.should.equal('bar')
          meta.id.should.equal('foo')
          done()
        })
      })
    })
    
    it('should get a json key', function(done) {
      helper(function(error, cb) {
        cb.get('foo2', function(error, data, meta) {
          error.should.equal(false)
          data.should.eql(testValue)
          meta.id.should.equal('foo2')
          done()
        })
      })
    })
    
    it('should fail with an error for a non-existing key', function(done) {
      helper(function(error, cb) {
        cb.get('foo3', function(error, data, meta) {
          error.should.equal(13)
          should.not.exist(data)
          meta.id.should.equal('foo3')
          done()
        })
      })
    })
  })
  
  describe('REPLACE', function() {
    it('should replace a key', function(done) {
      helper(function(error, cb) {
        cb.replace('foo', 'newbar', function(error, meta) {
          error.should.equal(false)
          meta.id.should.equal('foo')
          done()
        })
      })
    })
    
    it('should fail with an error replacing a non-existing key', function(done) {
      helper(function(error, cb) {
        cb.replace('foo4', 'newbar', function(error, meta) {
          error.should.equal(13)
          meta.id.should.equal('foo4')
          done()
        })
      })
    })
  })
  
  describe('ADD', function() {
    it('should add a new key-value pair', function(done) {
      helper(function(error, cb) {
        cb.add('foo5', 'bar', function(error, meta) {
          error.should.equal(false)
          meta.id.should.equal('foo5')
          done()
        })
      })
    })
    
    it('should fail adding an existing key', function(done) {
      helper(function(error, cb) {
        cb.add('foo5', 'newbar', function(error, meta) {
          error.should.equal(12)
          meta.id.should.equal('foo5')
          done()
        })
      })
    })
  })
  
  describe('DELETE', function() {
    it('should delete foo', function(done) {
      helper(function(error, cb) {
        cb.delete('foo', function(error, meta) {
          error.should.equal(false)
          meta.id.should.equal('foo')
          done()
        })
      })
    })
    
    it('should delete foo2', function(done) {
      helper(function(error, cb) {
        cb.delete('foo2', function(error, meta) {
          error.should.equal(false)
          meta.id.should.equal('foo2')
          done()
        })
      })
    })
    
    it('should delete foo5', function(done) {
      helper(function(error, cb) {
        cb.delete('foo5', function(error, meta) {
          error.should.equal(false)
          meta.id.should.equal('foo5')
          done()
        })
      })
    })
    
    it('should fail deleting a non-existing key', function(done) {
      helper(function(error, cb) {
        cb.delete('foo6', function(error, meta) {
          error.should.equal(13)
          meta.id.should.equal('foo6')
          done()
        })
      })
    })
  })
})