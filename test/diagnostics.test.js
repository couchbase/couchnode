'use strict';

var assert = require('assert');
var harness = require('./harness.js');

describe('#Bucket Diagnostics', function() {
  var H = harness;

  it('should successfully ping the server', function(done) {
    H.b.ping(
      [H.lib.ServiceType.KeyValue, H.lib.ServiceType.Views],
      H.okCallback(function(res) {
        assert.ok(res.id);
        assert.ok(res.sdk);
        assert.equal(res.version, 1);
        done();
      })
    );
  });

  it('should successfully get diagnostics info from the client', function(done) {
    H.b.diagnostics(
      H.okCallback(function(res) {
        assert.ok(res.id);
        assert.ok(res.sdk);
        assert.equal(res.version, 1);
        done();
      })
    );
  });
});
