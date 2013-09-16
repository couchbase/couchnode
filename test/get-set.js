var assert = require('assert');
var H = require('../test_harness.js');
var couchbase = require('../lib/couchbase.js');

var cb = H.newClient();

describe('#get/set', function() {

  it('should work in basic cases', function(done) {
    var key = H.genKey("set");
    cb.set(key, "bar", H.okCallback(function(firstmeta){
      // nothing broke
      cb.set(key, "baz", H.okCallback(function(secondmeta){
        assert.notDeepEqual(firstmeta.cas, secondmeta.cas, "CAS should change");
        cb.set(key, "bam", firstmeta, function(err, meta){
          assert(err, "Key should fail with stale CAS");
          cb.get(key, H.okCallback(function(result){
            assert.equal(result.value, "baz");
            cb.set(key, "grr", secondmeta, H.okCallback(function(meta){
              cb.get(key, H.okCallback(function(result){
                assert.equal("grr", result.value);
                done();
              }));
            }));
          }));
        });
      }));
    }));
  });

  it('should work when passing json strings', function(done) {
    var key = H.genKey("set-json");
    cb.set(key, JSON.stringify({foo: "bar"}), H.okCallback(function(){
      cb.set(key, JSON.stringify({foo: "baz"}), H.okCallback(function(){
        cb.get(key, H.okCallback(function(result){
          assert.equal(JSON.stringify({foo: "baz"}), result.value);
          done();
        }));
      }));
    }));
  });

  it('should work when passing large values', function(done) {
    var key = H.genKey("set-big");

    var value = "";
    for (var ii = 0; ii < 8192; ++ii) {
      value += "012345678\n";
    }

    cb.set(key, value, H.okCallback(function(setres) {
      cb.get(key, H.okCallback(function(getres) {
        assert.equal(value, getres.value);
        done();
      }));
    }));
  });

  it('should convert objects to json and back', function(done) {
    var key = H.genKey("set-format");

    H.setGet(key, {foo: "bar"}, function(doc) {
      assert.equal("bar", doc.foo);
      done();
    });
  });

  it('should round-trip Unicode values', function(done) {
    var key = H.genKey("set-unicode");
    var value = ['☆'];

    H.setGet(key, value, function(doc){
      assert.deepEqual(value, doc);
      done();
    });
  });

  it('should return raw string when using format option', function(done) {
    var value = [1,2,3,4,5,6];
    var key = H.genKey("set-raw");

    cb.set(key, value, H.okCallback(function(){
      cb.get(key, { format: 'raw' }, H.okCallback(function(result){
        assert.equal(result.value, JSON.stringify(value));
        done();
      }));
    }));
  });

  it('should properly handle setting raw strings', function(done) {
    var value = "hello";
    var key = H.genKey("set-json-strings");

    cb.set(key, value, { format: 'json' }, H.okCallback(function(){
      cb.get(key, H.okCallback(function(result){
        assert.equal(result.value, value);
        cb.get(key, { format: 'raw' }, H.okCallback(function(result){
          assert.equal(result.value, '"hello"');
          done();
        }));
      }));
    }));
  });

  it('should handle setting unencodable values', function(done) {
    var value = [1,2,3,4];
    var key = H.genKey("set-utf8-unconvertible");

    cb.set(key, value, { format: 'raw' }, function(err, meta){
      assert(err);
      done();
    });
  });

  it('should round-trip raw Buffers', function(done) {
    var buf = new Buffer([0, 1, 2]);
    // \x00, \x01, \x02
    var key = H.genKey("set-raw-format");

    cb.set(key, buf, H.okCallback(function(){
      cb.get(key, H.okCallback(function(meta){
        var doc = meta.value;
        assert(Buffer.isBuffer(doc));
        assert.deepEqual(buf, doc);
        assert.equal(meta.flags, couchbase.format.raw);
        done();
      }));
    }));
  });

  it('should allow overriding of flags', function(done) {
    var value = {val:"value"};
    var key = H.genKey("set-flags-override");

    // Note that we must specify the format as the flags no longer carries it
    cb.set(key, value, {flags: 14}, H.okCallback(function(){
      cb.get(key, {format: couchbase.format.json},
          H.okCallback(function(result){
        assert.deepEqual(result.value, value);
        assert.equal(result.flags, 14);
        done();
      }));
    }));
  });

});
