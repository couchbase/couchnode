var assert = require('assert');
var H = require('../test_harness.js');

var cb = H.newClient();

describe('#miscellaneous', function() {

  it('should ignore undefined option values', function(done) {
    var key = H.genKey("undefinedopts");
    cb.set(key, "blah", {hashkey: undefined}, H.okCallback(function(){
      done();
    }));
  });

});
