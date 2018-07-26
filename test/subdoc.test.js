'use strict';

var assert = require('assert');
var harness = require('./harness.js');

var H = harness;

describe('#subdoc', function() {
  it('should get correctly', function(done) {
    var itemMap = {
      test: 'lol'
    };

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
    var itemMap = {
      test: 'lol'
    };

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
    var itemMap = {
      test: [1, 2, 3, 4, 5]
    };

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

  it('should insert correctly', function(done) {
    var itemMap = {
      test: [1, 2, 3]
    };

    H.b.upsert('sdInsert', itemMap, H.okCallback(function() {
      H.b.mutateIn('sdInsert')
        .insert('val', 'nope')
        .insert('parent.val', 'yup', true)
        .insert('oparent.val', 'hello', {
          createParents: true
        })
        .execute(H.okCallback(function(res) {
          H.b.get('sdInsert', H.okCallback(function(res) {
            assert(res.value.val === 'nope');
            assert(res.value.parent.val === 'yup');
            assert(res.value.oparent.val === 'hello');
            done();
          }));
        }));
    }));
  });

  it('should upsert correctly', function(done) {
    var itemMap = {
      test: [1, 2, 3]
    };

    H.b.upsert('sdUpsert', itemMap, H.okCallback(function() {
      H.b.mutateIn('sdUpsert')
        .upsert('test', 'nope')
        .upsert('parent.val', 'yup', true)
        .upsert('oparent.val', 'hello', {
          createParents: true
        })
        .execute(H.okCallback(function(res) {
          H.b.get('sdUpsert', H.okCallback(function(res) {
            assert(res.value.test === 'nope');
            assert(res.value.parent.val === 'yup');
            assert(res.value.oparent.val === 'hello');
            done();
          }));
        }));
    }));
  });

  it('should remove correctly', function(done) {
    var itemMap = {
      test: [1, 2, 3],
      val: 14
    };

    H.b.upsert('sdRemove', itemMap, H.okCallback(function() {
      H.b.mutateIn('sdRemove')
        .remove('test')
        .execute(H.okCallback(function(res) {
          H.b.get('sdRemove', H.okCallback(function(res) {
            assert(res.value.val === 14);
            assert(res.value.test === undefined);
            done();
          }));
        }));
    }));
  });

  it('should use xattrs correctly', function(done) {
    var itemMap = {
      test: [1, 2, 3],
      val: 14
    };

    H.b.mutateIn('sdXattr', {
        upsert: true
      })
      .upsert('test.val', 14, {
        xattr: true
      })
      .upsert('lol', 19)
      .execute(H.okCallback(function(res) {
        H.b.get('sdXattr', H.okCallback(function(res) {
          assert(res.value.lol === 19);
          assert(res.value.test === undefined);
          done();
        }));
      }));
  });

  it('should use arrayAppend and arrayAppendAll correctly', function(done) {
    var itemMap = {
      test: [1, 2, 3]
    };

    H.b.upsert('sdArrAppend', itemMap, H.okCallback(function() {
      H.b.mutateIn('sdArrAppend')
        .arrayAppend('test', 4)
        .execute(H.okCallback(function(res) {
          H.b.mutateIn('sdArrAppend')
            .arrayAppendAll('test', [5, 6, 7])
            .execute(H.okCallback(function(res) {
              H.b.get('sdArrAppend', H.okCallback(
                function(res) {
                  assert.deepEqual(res.value.test, [1,
                    2, 3, 4, 5, 6, 7
                  ]);
                  done();
                }));
            }));
        }));
    }));
  });

  it('should use arrayPrepend and arrayPrependAll correctly', function(done) {
    var itemMap = {
      test: [5, 6, 7]
    };

    H.b.upsert('sdArrPrepend', itemMap, H.okCallback(function() {
      H.b.mutateIn('sdArrPrepend')
        .arrayPrepend('test', 4)
        .execute(H.okCallback(function(res) {
          H.b.mutateIn('sdArrPrepend')
            .arrayPrependAll('test', [1, 2, 3])
            .execute(H.okCallback(function(res) {
              H.b.get('sdArrPrepend', H.okCallback(
                function(res) {
                  assert.deepEqual(res.value.test, [1,
                    2, 3, 4, 5, 6, 7
                  ]);
                  done();
                }));
            }));
        }));
    }));
  });

  it('should use arrayInsert and arrayInsertAll correctly', function(done) {
    var itemMap = {
      test: [1, 2, 6, 7]
    };

    H.b.upsert('sdArrInsert', itemMap, H.okCallback(function() {
      H.b.mutateIn('sdArrInsert')
        .arrayInsert('test[2]', 3)
        .execute(H.okCallback(function(res) {
          H.b.mutateIn('sdArrInsert')
            .arrayInsertAll('test[3]', [4, 5])
            .execute(H.okCallback(function(res) {
              H.b.get('sdArrInsert', H.okCallback(
                function(res) {
                  assert.deepEqual(res.value.test, [1,
                    2, 3, 4, 5, 6, 7
                  ]);
                  done();
                }));
            }));
        }));
    }));
  });
});
