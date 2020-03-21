'use strict';

var assert = require('assert');
var cls_hooked = require('cls-hooked');
var async_hooks = require('../lib/async_hooks_stub');
var harness = require('./harness.js');

var asyncns = cls_hooked.createNamespace('test');

describe('#async', function() {
  function allTests(H) {
    if (async_hooks.supported) {
      it('should properly handle async contexts', function(done) {
        asyncns.run(function() {
          asyncns.set('value', 'ctxisworking');

          H.b.get('test', function() {
            assert.equal(asyncns.get('value'), 'ctxisworking');

            H.b.get('test', function() {
              assert.equal(asyncns.get('value'), 'ctxisworking');
              done();
            });
          });
        });
      });
    } else {
      it.skip('should properly handle async contexts');
    }
  }

  describe('#RealBucket', allTests.bind(this, harness));
  describe('#MockBucket', allTests.bind(this, harness.mock));
});
