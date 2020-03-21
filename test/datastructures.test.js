'use strict';

var assert = require('assert');
var harness = require('./harness.js');

var H = harness;

describe('#datastructures', function() {
  describe('#maps', function() {
    it('should get and size correctly', function(done) {
      var itemMap = {
        one: '1',
        two: '2',
        three: '3',
        four: '4',
      };

      H.b.upsert(
        'mapGet',
        itemMap,
        H.okCallback(function() {
          H.b.mapGet(
            'mapGet',
            'three',
            H.okCallback(function(res) {
              assert(res.value === '3');

              H.b.mapSize(
                'mapGet',
                H.okCallback(function(res) {
                  assert(res.value === 4);

                  done();
                })
              );
            })
          );
        })
      );
    });

    it('should remove correctly', function(done) {
      var itemMap = {
        one: '1',
        two: '2',
        three: '3',
        four: '4',
      };

      H.b.upsert(
        'mapRemove',
        itemMap,
        H.okCallback(function() {
          H.b.mapRemove(
            'mapRemove',
            'two',
            H.okCallback(function() {
              H.b.get(
                'mapRemove',
                H.okCallback(function(res) {
                  assert(res.value.two === undefined);

                  done();
                })
              );
            })
          );
        })
      );
    });

    it('should add correctly', function(done) {
      var itemMap = {
        one: '1',
        two: '2',
      };

      H.b.upsert(
        'mapAdd',
        itemMap,
        H.okCallback(function() {
          H.b.mapAdd(
            'mapAdd',
            'three',
            '3',
            H.okCallback(function() {
              H.b.get(
                'mapAdd',
                H.okCallback(function(res) {
                  assert(res.value.three === '3');

                  done();
                })
              );
            })
          );
        })
      );
    });
  });

  describe('#list', function() {
    it('should get/size correctly', function(done) {
      var itemArray = ['one', 'two', 'three', 'four'];

      H.b.upsert(
        'listGet',
        itemArray,
        H.okCallback(function() {
          H.b.listGet(
            'listGet',
            1,
            H.okCallback(function(res) {
              assert(res.value === 'two');

              H.b.listSize(
                'listGet',
                H.okCallback(function(res) {
                  assert(res.value === 4);

                  done();
                })
              );
            })
          );
        })
      );
    });

    it('should append/prepend correctly', function(done) {
      var itemArray = ['one'];

      H.b.upsert(
        'listAppendPrepend',
        itemArray,
        H.okCallback(function() {
          H.b.listAppend(
            'listAppendPrepend',
            'two',
            H.okCallback(function() {
              H.b.listPrepend(
                'listAppendPrepend',
                'three',
                H.okCallback(function() {
                  H.b.get(
                    'listAppendPrepend',
                    H.okCallback(function(res) {
                      assert(res.value.length === 3);
                      assert(res.value[0] === 'three');
                      assert(res.value[2] === 'two');

                      done();
                    })
                  );
                })
              );
            })
          );
        })
      );
    });

    it('should remove correctly', function(done) {
      var itemArray = ['one', 'two', 'three', 'four'];

      H.b.upsert(
        'listRemove',
        itemArray,
        H.okCallback(function() {
          H.b.listRemove(
            'listRemove',
            2,
            H.okCallback(function() {
              H.b.get(
                'listRemove',
                H.okCallback(function(res) {
                  assert(res.value.length === 3);

                  done();
                })
              );
            })
          );
        })
      );
    });

    it('should set correctly', function(done) {
      var itemArray = ['one', 'two', 'three', 'four'];

      H.b.upsert(
        'listSet',
        itemArray,
        H.okCallback(function() {
          H.b.listSet(
            'listSet',
            2,
            'six',
            H.okCallback(function() {
              H.b.get(
                'listSet',
                H.okCallback(function(res) {
                  assert(res.value[2] === 'six');

                  done();
                })
              );
            })
          );
        })
      );
    });
  });

  describe('#sets', function() {
    it('should add correctly', function(done) {
      var itemArray = ['one'];

      H.b.upsert(
        'setAdd',
        itemArray,
        H.okCallback(function() {
          H.b.setAdd(
            'setAdd',
            'four',
            H.okCallback(function() {
              H.b.get(
                'setAdd',
                H.okCallback(function(res) {
                  assert(res.value.length === 2);

                  done();
                })
              );
            })
          );
        })
      );
    });

    it('should check exists correctly', function(done) {
      var itemArray = ['one', 'two', 'three'];

      H.b.upsert(
        'setExists',
        itemArray,
        H.okCallback(function() {
          H.b.setExists(
            'setExists',
            'three',
            H.okCallback(function(res) {
              assert(res.value === true);

              H.b.setExists(
                'setExists',
                'five',
                H.okCallback(function(res) {
                  assert(res.value === false);

                  done();
                })
              );
            })
          );
        })
      );
    });

    it('should remove correctly', function(done) {
      var itemArray = ['one', 'two', 'three', 'four'];

      H.b.upsert(
        'setRemove',
        itemArray,
        H.okCallback(function() {
          H.b.setRemove(
            'setRemove',
            'three',
            H.okCallback(function() {
              H.b.get(
                'setRemove',
                H.okCallback(function(res) {
                  assert(res.value.length === 3);

                  done();
                })
              );
            })
          );
        })
      );
    });

    it('should get size correctly', function(done) {
      var itemArray = ['one', 'two', 'three'];

      H.b.upsert(
        'setSize',
        itemArray,
        H.okCallback(function() {
          H.b.setSize(
            'setSize',
            H.okCallback(function(res) {
              assert(res.value === 3);

              done();
            })
          );
        })
      );
    });
  });

  describe('#queue', function() {
    it('should get size correctly', function(done) {
      var itemArray = ['one', 'two', 'three', 'four'];

      H.b.upsert(
        'queueSize',
        itemArray,
        H.okCallback(function() {
          H.b.listSize(
            'queueSize',
            H.okCallback(function(res) {
              assert(res.value === 4);

              done();
            })
          );
        })
      );
    });

    it('should push correctly', function(done) {
      var itemArray = ['one', 'two'];

      H.b.upsert(
        'queuePush',
        itemArray,
        H.okCallback(function() {
          H.b.queuePush(
            'queuePush',
            'three',
            H.okCallback(function() {
              H.b.get(
                'queuePush',
                H.okCallback(function(res) {
                  assert(res.value.length === 3);
                  assert(res.value[0] === 'three');

                  done();
                })
              );
            })
          );
        })
      );
    });

    it('should pop correctly', function(done) {
      var itemArray = ['one', 'two', 'three'];

      H.b.upsert(
        'queuePop',
        itemArray,
        H.okCallback(function() {
          H.b.queuePop(
            'queuePop',
            H.okCallback(function(res) {
              assert(res.value === 'three');

              H.b.get(
                'queuePop',
                H.okCallback(function(res) {
                  assert(res.value.length === 2);
                  assert(res.value[0] === 'one');
                  assert(res.value[1] === 'two');

                  done();
                })
              );
            })
          );
        })
      );
    });
  });
});
