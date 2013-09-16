var assert = require('assert');
var H = require('../test_harness.js');
var couchbase = require('../lib/couchbase.js');

var cb = H.newClient();

describe('#ctl', function() {

  it('should return vBucket mapping for keys', function(done) {
    var key = H.genKey("ctlMsssssap");
    cb.set(key, "blah", H.okCallback(function(){
      var res = cb.vbMappingInfo(key);
      assert(res.length == 2);
      assert.equal(typeof res[0], 'number');
      assert.equal(typeof res[1], 'number');
      done();
    }));
  });

});
