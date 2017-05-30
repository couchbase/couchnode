'use strict';

var assert = require('assert');
var harness = require('./harness.js');

var H = harness;

describe('#subdoc', function () {
  it('should get correctly', function(done) {
    var itemMap = {test: 'lol'};

    H.b.upsert('sdGet', itemMap, H.okCallback(function() {
      H.b.lookupIn('sdGet')
          .get('test')
          .execute(H.okCallback(function(res) {
            assert(res.content('test') === 'lol');
            assert(res.contentByIndex(0) === 'lol');

            done();
          }));
    }));
  });

  it('should exists correctly', function(done) {
    var itemMap = {test: 'lol'};

    H.b.upsert('sdExists', itemMap, H.okCallback(function() {
      H.b.lookupIn('sdExists')
          .exists('test')
          .exists('nope')
          .execute(function(err, res) {
            assert(res.exists('test') === true);
            assert(res.exists('nope') === false);

            done();
          });
    }));
  });

  it('should getCount correctly', function(done) {
    var itemMap = {test: [1, 2, 3, 4, 5]};

    H.b.upsert('sdGetCount', itemMap, H.okCallback(function() {
      H.b.lookupIn('sdGetCount')
          .getCount('test')
          .execute(H.okCallback(function(res) {
        assert(res.content('test') === 5);
        assert(res.contentByIndex(0) === 5);

        done();
      }));
    }));
  });
});
