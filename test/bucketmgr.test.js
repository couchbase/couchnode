'use strict';

var assert = require('assert');
var harness = require('./harness.js');

describe('#bucket management', function() {
  function allTests(H) {
    it('should have correct views tree', function (done) {
      var bMgr = H.b.manager();

      var ddoc = {views:{
        'test': {
          map: 'function (doc,meta) {}'
        }
      }};
      bMgr.upsertDesignDocument('dev_test', ddoc, function(err) {
        assert(!err);
        bMgr.getDesignDocuments(function (err, ddocs) {
          assert(!err);
          assert.deepEqual(ddocs['dev_test'], ddoc);
          done();
        });
      });
    });
  }
  describe('#MockBucket', allTests.bind(this, harness.mock));
});
