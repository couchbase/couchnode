var assert = require('assert');
var H = require('../test_harness.js');

describe('#query formatting', function() {

  it('should format query strings correctly', function(done) {
    var str = H.lib.formatQuery('SELECT ?? FROM ?? WHERE ??=?', ['name', 'default', 'id', 'frank']);
    assert(str === "SELECT `name` FROM `default` WHERE `id`='frank'", 'query should be correct');
    done();
  });

});
