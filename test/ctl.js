var assert = require('assert');
var H = require('../test_harness.js');

describe('#ctl', function() {

  it('should return vBucket mapping for keys', function(done) {
    var cb = H.client;
    var key = H.genKey("ctlMsssssap");
    cb.set(key, "blah", H.okCallback(function(){
      var res = cb.vbMappingInfo(key);
      assert(res.length == 2);
      assert.equal(typeof res[0], 'number');
      assert.equal(typeof res[1], 'number');
      done();
    }));
  });

  it('should return proper client version', function(done) {
    var cb = H.client;
    var vresult = cb.clientVersion;
    assert.equal(typeof vresult, 'object');
    assert.equal(vresult.length, 2);
    assert.equal(typeof vresult[0], 'number');
    assert.equal(typeof vresult[1], 'string');
    done();
  });

});
