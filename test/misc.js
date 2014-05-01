var assert = require('assert');
var H = require('../test_harness.js');

describe('#miscellaneous', function() {

  it('should ignore undefined option values', function(done) {
    var cb = H.client;
    var key = H.genKey("undefinedopts");
    cb.set(key, "blah", {hashkey: undefined}, H.okCallback(function(){
      done();
    }));
  });

});
