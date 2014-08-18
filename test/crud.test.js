'use strict';

var assert = require('assert');
var harness = require('./harness.js');

describe('#crud', function () {
  function allTests(H) {
    function testBadBasic(fn) {
      it('should fail with an invalid key type', function () {
        assert.throws(function () {
          fn({}, undefined, H.noCallback());
        }, TypeError);
      });
      it('should fail with an invalid hashkey option', function () {
        assert.throws(function () {
          fn(H.key(), {hashkey: {}}, H.noCallback());
        }, TypeError);
      });
      it('should fail with non object options', function () {
        assert.throws(function () {
          fn(H.key(), 'opts', H.noCallback());
        }, TypeError);
      });
      it('should fail if no callback is passed', function () {
        assert.throws(function () {
          fn(H.key(), {});
        }, TypeError);
      });
    }
    function testBadDura(fn) {
      it('should fail for negative persist_to values', function() {
        assert.throws(function() {
          fn(H.key(), {persist_to:-1}, H.noCallback());
        });
      });
      it('should fail for negative replicate_to values', function() {
        assert.throws(function() {
          fn(H.key(), {replicate_to:-1}, H.noCallback());
        });
      });
      it('should fail for very-high persist_to values', function() {
        assert.throws(function() {
          fn(H.key(), {persist_to:10}, H.noCallback());
        });
      });
      it('should fail for very-high replicate_to values', function() {
        assert.throws(function() {
          fn(H.key(), {replicate_to:10}, H.noCallback());
        });
      });
    }
    function testBadExpiry(fn) {
      it('should fail with negative expiry', function () {
        assert.throws(function () {
          fn(H.key(), -1, H.noCallback());
        }, TypeError);
      });
      it('should fail with null expiry', function () {
        assert.throws(function () {
          fn(H.key(), null, H.noCallback());
        }, TypeError);
      });
      it('should fail with non-numeric expiry', function () {
        assert.throws(function () {
          fn(H.key(), '1', H.noCallback());
        }, TypeError);
      });
    }

    function testBadCas(fn) {
      it('should fail with an invalid cas option', function () {
        assert.throws(function () {
          fn(H.key(), 'frank', H.noCallback());
        }, TypeError);
      });
    }

    function testBadValue(fn) {
      it('should fail with an undefined value', function () {
        assert.throws(function () {
          fn(H.key(), undefined, H.noCallback());
        }, TypeError);
      });
    }

    describe('#store', function () {
      describe('upsert', function () {
        testBadBasic(function (key, options, callback) {
          H.b.upsert(key, 'bar', options, callback);
        });
        testBadExpiry(function (key, expiry, callback) {
          H.b.upsert(key, 'bar', {expiry: expiry}, callback);
        });
        testBadCas(function(key, cas, callback) {
          H.b.upsert(key, 'bar', {cas: cas}, callback);
        });
        testBadValue(function(key, value, callback) {
          H.b.upsert(key, value, {}, callback);
        });
        testBadDura(function(key, options, callback) {
          H.b.upsert(key, 'bar', options, callback);
        });
      });

      describe('insert', function () {
        testBadBasic(function (key, options, callback) {
          H.b.insert(key, 'bar', options, callback);
        });
        testBadExpiry(function (key, expiry, callback) {
          H.b.insert(key, 'bar', {expiry: expiry}, callback);
        });
        testBadCas(function(key, cas, callback) {
          H.b.insert(key, 'bar', {cas: cas}, callback);
        });
        testBadValue(function(key, value, callback) {
          H.b.insert(key, value, {}, callback);
        });
        testBadDura(function(key, options, callback) {
          H.b.insert(key, 'bar', options, callback);
        });
      });


    });

    describe('#retrieve', function () {
      describe('get', function () {
        testBadBasic(function (key, options, callback) {
          H.b.get(key, options, callback);
        });
      });
      describe('getMulti', function() {
        it('should fail with a non-array keys', function() {
          assert.throws(function() {
            H.b.getMulti('key', H.noCallback());
          }, TypeError);
        });
        it('should fail for undefined keys', function() {
          assert.throws(function() {
            H.b.getMulti(undefined, H.noCallback());
          }, TypeError);
        });
        it('should fail with an empty array of keys', function() {
          assert.throws(function() {
            H.b.getMulti([], H.noCallback());
          }, TypeError);
        });
        it('should fail with a missing callback', function() {
          assert.throws(function() {
            H.b.getMulti(['test1', 'test2']);
          }, TypeError);
        });
        it('should work normally', function(done) {
          var key1 = H.key();
          var key2 = H.key();
          H.b.insert(key1, 'foo', H.okCallback(function() {
            H.b.insert(key2, 'bar', H.okCallback(function() {
              H.b.getMulti([key1, key2], function(err, res) {
                assert(!err);
                assert(res);
                assert(res[key1]);
                assert(res[key1].cas);
                assert(res[key1].value);
                assert(!res[key1].error);
                assert(res[key2]);
                assert(res[key2].cas);
                assert(res[key2].value);
                assert(!res[key2].error);
                done();
              });
            }));
          }));
        });
        it('should work with partial failures', function(done) {
          var key1 = H.key();
          var key2 = H.key();
          H.b.insert(key1, 'foo', H.okCallback(function() {
            H.b.getMulti([key1, key2], function(err, res) {
              assert(err === 1);
              assert(res);
              assert(res[key1]);
              assert(res[key1].cas);
              assert(res[key1].value);
              assert(!res[key1].error);
              assert(res[key2]);
              assert(!res[key2].cas);
              assert(!res[key2].value);
              assert(res[key2].error);
              done();
            });
          }));
        });
      });
      describe('getAndLock', function () {
        testBadBasic(function (key, options, callback) {
          H.b.getAndLock(key, options, callback);
        });
        it('should fail with an invalid lockTime', function () {
          assert.throws(function () {
            H.b.getAndLock(H.key(), {lockTime: 0}, H.noCallback());
          }, TypeError);
        });
        it('should fail with a negative lockTime', function () {
          assert.throws(function () {
            H.b.getAndLock(H.key(), {lockTime: -1}, H.noCallback());
          }, TypeError);
        });
        it('should fail with an non-numeric lockTime', function () {
          assert.throws(function () {
            H.b.getAndLock(H.key(), {lockTime: '1'}, H.noCallback());
          }, TypeError);
        });
      });
      describe('getAndTouch', function () {
        testBadBasic(function (key, options, callback) {
          H.b.getAndTouch(key, 1, options, callback);
        });
        testBadExpiry(function (key, expiry, callback) {
          H.b.getAndTouch(key, expiry, {}, callback);
        });
        testBadDura(function(key, options, callback) {
          H.b.getAndTouch(key, 1, options, callback);
        });
      });
      describe('getReplica', function () {
        testBadBasic(function (key, options, callback) {
          H.b.getReplica(key, options, callback);
        });

        // This test just tries to invoke the function so that it appears to
        //  work in some way.  In reality, we can't consistently test this since
        //  we can't predetermine the cluster size.
        it('should not crash', function(done) {
          H.b.getReplica(H.key(), function () {
            done();
          });
        });
      });
    });

    describe('#misc', function () {
      describe('remove', function () {
        testBadBasic(function (key, options, callback) {
          H.b.remove(key, options, callback);
        });
        testBadCas(function(key, cas, callback) {
          H.b.remove(key, {cas: cas}, callback);
        });
        testBadDura(function(key, options, callback) {
          H.b.remove(key, options, callback);
        });

        it('should fail on missing key', function(done) {
          H.b.remove(H.key(), function(err, res) {
            assert(err);
            assert(!res);
            done();
          });
        });
        it('should fail on a locked key', function(done) {
          var key = H.key();
          H.b.insert(key, 'foo', H.okCallback(function(){
            H.b.getAndLock(key, H.okCallback(function() {
              H.b.remove(key, function(err, res) {
                assert(err);
                assert(!res);
                done();
              });
            }));
          }));
        });
      });

      describe('unlock', function () {
        testBadBasic(function (key, options, callback) {
          H.b.unlock(key, {}, options, callback);
        });
        testBadCas(function(key, cas, callback) {
          H.b.unlock(key, cas, callback);
        });
        it('should fail on missing key', function(done) {
          H.b.unlock(H.key(), {}, function(err, res) {
            assert(err);
            assert(!res);
            done();
          });
        });
        it('should fail on an never been locked key', function(done) {
          var key = H.key();
          H.b.insert(key, 'foo', H.okCallback(function(insertRes) {
            H.b.unlock(key, insertRes.cas, function(err, res) {
              assert(err);
              assert(!res);
              done();
            });
          }));
        });
        it('should fail on a timed out lock (slow)', function(done) {
          this.timeout(3000);
          var key = H.key();
          H.b.insert(key, 'foo', H.okCallback(function(insertRes) {
            H.b.getAndLock(key, {lockTime:1}, H.okCallback(function(lockRes) {
              setTimeout(function() {
                H.b.unlock(key, lockRes.cas, function(err, res) {
                  assert(err);
                  assert(!res);
                  done();
                });
              },2000);
            }));
          }));
        });
        it('should fail for an incorrect as', function(done) {
          var key = H.key();
          H.b.insert(key, 'foo', H.okCallback(function(insertRes) {
            H.b.getAndLock(key, H.okCallback(function() {
              H.b.unlock(key, insertRes.cas, function(err, res) {
                assert(err);
                assert(!res);
                done();
              });
            }));
          }));
        });
        it('should actually unlock the key', function(done) {
          var key = H.key();
          H.b.insert(key, 'foo', H.okCallback(function() {
            H.b.getAndLock(key, H.okCallback(function(lockRes) {
              H.b.unlock(key, lockRes.cas, function() {
                H.b.replace(key, 'bar', H.okCallback(function() {
                  done();
                }));
              });
            }));
          }));
        });
      });

      describe('touch', function () {
        testBadBasic(function (key, options, callback) {
          H.b.touch(key, 1, options, callback);
        });
        testBadExpiry(function (key, expiry, callback) {
          H.b.touch(key, expiry, {}, callback);
        });
        testBadDura(function(key, options, callback) {
          H.b.touch(key, options, callback);
        });
      });

      describe('counter', function() {
        testBadBasic(function (key, options, callback) {
          H.b.counter(key, 1, options, callback);
        });
        testBadDura(function(key, options, callback) {
          H.b.counter(key, 1, options, callback);
        });

        it('should fail when passed a 0 delta', function () {
          assert.throws(function () {
            H.b.counter(H.key(), 0, H.noCallback());
          }, TypeError);
        });
        it('should fail when passed a non-numeric delta', function () {
          assert.throws(function () {
            H.b.counter(H.key(), {}, H.noCallback());
          }, TypeError);
        });
        it('should fail when passed a negative initial', function () {
          assert.throws(function () {
            H.b.counter(H.key(), 1, {initial:-1}, H.noCallback());
          }, TypeError);
        });
        it('should fail when passed a non-numeric initial', function () {
          assert.throws(function () {
            H.b.counter(H.key(), 1, {initial:{}}, H.noCallback());
          }, TypeError);
        });

        it('should increment properly', function(done) {
          var key = H.key();
          H.b.insert(key, '6', H.okCallback(function() {
            H.b.counter(key, 1, H.okCallback(function(res) {
              assert(res.value, 7);
              H.b.get(key, H.okCallback(function(getRes) {
                assert(getRes.value, res.value);
                done();
              }));
            }));
          }));
        });

        it('should add properly', function(done) {
          var key = H.key();
          H.b.insert(key, '6', H.okCallback(function() {
            H.b.counter(key, 3, H.okCallback(function(res) {
              assert(res.value, 9);
              H.b.get(key, H.okCallback(function(getRes) {
                assert(getRes.value, res.value);
                done();
              }));
            }));
          }));
        });

        it('should decrement properly', function(done) {
          var key = H.key();
          H.b.insert(key, '6', H.okCallback(function() {
            H.b.counter(key, -1, H.okCallback(function(res) {
              assert(res.value, 5);
              H.b.get(key, H.okCallback(function(getRes) {
                assert(getRes.value, res.value);
                done();
              }));
            }));
          }));
        });

        it('should subtract properly', function(done) {
          var key = H.key();
          H.b.insert(key, '6', H.okCallback(function() {
            H.b.counter(key, -3, H.okCallback(function(res) {
              assert.equal(res.value, 3);
              H.b.get(key, H.okCallback(function(getRes) {
                assert.equal(getRes.value, res.value);
                done();
              }));
            }));
          }));
        });

        it('should fail on missing key', function(done) {
          H.b.counter(H.key(), 1, function(err, res) {
            assert(err);
            assert(!res);
            done();
          });
        });
        it('should fail on a locked key', function(done) {
          var key = H.key();
          H.b.insert(key, 'foo', H.okCallback(function(){
            H.b.getAndLock(key, H.okCallback(function() {
              H.b.counter(key, 1, function(err, res) {
                assert(err);
                assert(!res);
                done();
              });
            }));
          }));
        });

        it('should create with initial set', function(done) {
          var key = H.key();
          H.b.counter(key, 1, {initial:7}, H.okCallback(function(res) {
            assert.equal(res.value, 7);
            H.b.get(key, H.okCallback(function(getRes) {
              assert.equal(getRes.value, '7');
              done();
            }));
          }));
        });
      });

      describe('append', function() {
        testBadBasic(function (key, options, callback) {
          H.b.append(key, 'foo', options, callback);
        });
        testBadDura(function(key, options, callback) {
          H.b.append(key, 'foo', options, callback);
        });

        it('should append to a key', function(done) {
          var key = H.key();
          H.b.insert(key, 'foo', H.okCallback(function(insertRes) {
            H.b.append(key, 'bar', H.okCallback(function(appendRes) {
              assert.notDeepEqual(insertRes.cas, appendRes.cas);
              H.b.get(key, H.okCallback(function(getRes) {
                assert.deepEqual(getRes.cas, appendRes.cas);
                assert.equal(getRes.value, 'foobar');
                done();
              }));
            }));
          }));
        });
        it('should fail on missing key', function(done) {
          H.b.append(H.key(), 'foo', function(err, res) {
            assert(err);
            assert(!res);
            done();
          });
        });
        it('should fail on a locked key', function(done) {
          var key = H.key();
          H.b.insert(key, 'foo', H.okCallback(function(){
            H.b.getAndLock(key, H.okCallback(function() {
              H.b.append(key, 'bar', function(err, res) {
                assert(err);
                assert(!res);
                done();
              });
            }));
          }));
        });
      });

      describe('prepend', function() {
        testBadBasic(function (key, options, callback) {
          H.b.prepend(key, 'foo', options, callback);
        });
        testBadDura(function(key, options, callback) {
          H.b.prepend(key, 'foo', options, callback);
        });

        it('should prepend to a key', function(done) {
          var key = H.key();
          H.b.insert(key, 'foo', H.okCallback(function(insertRes) {
            H.b.prepend(key, 'bar', H.okCallback(function(appendRes) {
              assert.notDeepEqual(insertRes.cas, appendRes.cas);
              H.b.get(key, H.okCallback(function(getRes) {
                assert.deepEqual(getRes.cas, appendRes.cas);
                assert.equal(getRes.value, 'barfoo');
                done();
              }));
            }));
          }));
        });
        it('should fail on missing key', function(done) {
          H.b.prepend(H.key(), 'foo', function(err, res) {
            assert(err);
            assert(!res);
            done();
          });
        });
        it('should fail on a locked key', function(done) {
          var key = H.key();
          H.b.insert(key, 'foo', H.okCallback(function(){
            H.b.getAndLock(key, H.okCallback(function() {
              H.b.prepend(key, 'bar', function(err, res) {
                assert(err);
                assert(!res);
                done();
              });
            }));
          }));
        });
      });
    });

    it('should successfully round-trip a document', function (done) {
      var key = H.key();
      var doc = {x: 'hello', y: 'world'};
      H.b.insert(key, doc, H.okCallback(function () {
        H.b.get(key, H.okCallback(function (res) {
          assert.deepEqual(res.value, doc);
          done();
        }));
      }));
    });

    it('should fail to insert an already existing document', function(done) {
      var key = H.key();
      H.b.insert(key, 'bar', H.okCallback(function() {
        H.b.insert(key, 'foo', function(err, res) {
          assert(err);
          done();
        });
      }));
    });

    it('should successfully upsert a document', function(done) {
      var key = H.key();
      H.b.upsert(key, 'bar', H.okCallback(function(upsertRes){
        H.b.get(key, H.okCallback(function(getRes) {
          assert.deepEqual(getRes.cas, upsertRes.cas);
          done();
        }))
      }));
    });

    it('should fail upsert on a locked key', function(done) {
      var key = H.key();
      H.b.insert(key, 'foo', H.okCallback(function(){
        H.b.getAndLock(key, H.okCallback(function() {
          H.b.upsert(key, 'bar', function(err, res) {
            assert(err);
            assert(!res);
            done();
          });
        }));
      }));
    });

    it('should fail replace on a locked key', function(done) {
      var key = H.key();
      H.b.insert(key, 'foo', H.okCallback(function(){
        H.b.getAndLock(key, H.okCallback(function() {
          H.b.replace(key, 'bar', function(err, res) {
            assert(err);
            assert(!res);
            done();
          });
        }));
      }));
    });


    it('should fail upsert with cas mismatch', function(done) {
      var key = H.key();
      H.b.insert(key, 'foo', H.okCallback(function(insertRes){
        H.b.upsert(key, 'bar', H.okCallback(function(){
          H.b.upsert(key, 'wat', {cas:insertRes.cas}, function(err, res) {
            assert(err);
            assert(!res);
            done();
          });
        }));
      }));
    });

    it('should successfully expire a document (slow)', function (done) {
      this.timeout(3000);
      var key = H.key();
      H.b.insert(key, 'foo', {expiry: 1}, H.okCallback(function () {
        H.b.get(key, H.okCallback(function () {
          setTimeout(function () {
            H.b.get(key, function (err) {
              assert(err);
              done();
            });
          }, 2000);
        }));
      }));
    });

    function touchTests(touchFn) {
      it('should succesfully update expiry (slow)', function(done) {
        this.timeout(5000);
        var key = H.key();
        H.b.insert(key, 'foo', {expiry: 1}, H.okCallback(function () {
          touchFn(key, 2, H.okCallback(function (res) {
            setTimeout(function () {
              H.b.get(key, H.okCallback(function() {
                setTimeout(function() {
                  H.b.get(key, function (err, res) {
                    assert(err);
                    assert(!res);
                    done();
                  });
                }, 3000);
              }));
            }, 100);
          }));
        }));
      });
      it('should fail on missing key', function(done) {
        touchFn(H.key(), 1, function(err, res) {
          assert(err);
          assert(!res);
          done();
        });
      });
      it('should fail on a locked key', function(done) {
        var key = H.key();
        H.b.insert(key, 'foo', H.okCallback(function(){
          H.b.getAndLock(key, H.okCallback(function() {
            touchFn(key, 1, function(err, res) {
              assert(err);
              assert(!res);
              done();
            });
          }));
        }));
      });
    }
    describe('getAndTouch', function() {
      touchTests(function(key, expiry, callback) {
        H.b.getAndTouch(key, expiry, callback);
      });
    });
    describe('touch', function() {
      touchTests(function(key, expiry, callback) {
        H.b.touch(key, expiry, callback);
      });
    });

    it('should require an accurate cas', function (done) {
      var key = H.key();
      H.b.insert(key, 'bar', H.okCallback(function (insertRes) {
        H.b.replace(key, 'foo', H.okCallback(function () {
          H.b.replace(key, 'dog', {cas: insertRes.cas}, function (err) {
            assert(err);
            done();
          });
        }));
      }));
    });

    it('should work with a valid cas', function (done) {
      var key = H.key();
      H.b.insert(key, 'bar', H.okCallback(function (insertRes) {
        H.b.replace(key, 'dog', {cas: insertRes.cas}, H.okCallback(function () {
          done();
        }));
      }));
    });

    it('should be able to remove a document', function(done) {
      var key = H.key();
      H.b.insert(key, 'bar', H.okCallback(function(insertRes) {
        H.b.remove(key, H.okCallback(function(removeRes) {
          assert.notDeepEqual(insertRes.cas, removeRes.cas);
          H.b.get(key, function(getErr, getRes) {
            assert(getErr);
            assert(!getRes);
            done();
          });
        }));
      }));
    });

    it('getAndLock should get the value', function(done) {
      var key = H.key();
      H.b.insert(key, 'bar', H.okCallback(function(insertRes) {
        H.b.getAndLock(key, H.okCallback(function(lockRes){
          assert.notDeepEqual(insertRes.cas, lockRes.cas);
          assert.equal(lockRes.value, 'bar');
          done();
        }));
      }));
    });

    it('get should work on a locked key', function(done) {
      var key = H.key();
      H.b.insert(key, 'bar', H.okCallback(function() {
        H.b.getAndLock(key, H.okCallback(function(){
          H.b.get(key, H.okCallback(function(res) {
            assert(res.value, 'bar');
            done();
          }));
        }));
      }));
    });

    it('should fail getAndLock for missing key', function(done) {
      H.b.getAndLock(H.key(), function(err, res) {
        assert(err);
        assert(!res);
        done();
      });
    });

    it('should fail getAndLock for locked key', function(done) {
      var key = H.key();
      H.b.insert(key, 'bar', H.okCallback(function(insertRes) {
        H.b.getAndLock(key, {lockTime: 1}, H.okCallback(function (lockRes) {
          assert.notDeepEqual(insertRes.cas, lockRes.cas);
          H.b.getAndLock(key, function(err, res) {
            assert(err);
            assert(!res);
            done();
          });
        }));
      }));
    });

    it('should set the correct lockTime (slow)', function(done) {
      // This test takes at least 2000ms to execute due to Server lock time
      //   rounding issue (locktime 1000ms takes up to 1999ms to expire).
      this.timeout(3000);
      var key = H.key();
      H.b.insert(key, 'bar', H.okCallback(function(insertRes) {
        H.b.getAndLock(key, {lockTime:1}, H.okCallback(function(lockRes){
          assert.notDeepEqual(insertRes.cas, lockRes.cas);
          H.b.replace(key, 'foo', function(getErr, getRes) {
            assert(getErr);
            assert(!getRes);
            setTimeout(function() {
              H.b.replace(key, 'rew', H.okCallback(function(replaceRes) {
                assert.notDeepEqual(lockRes.cas, replaceRes.cas);
                done();
              }));
            }, 2000);
          });
        }));
      }));
    });

    it('should fail to get a missing key', function(done) {
      H.b.get(H.key(), function(err, res) {
        assert(err);
        assert(!res);
        done();
      });
    });

    it('durability should not crash', function (done) {
      this.timeout(4000);
      H.b.insert(H.key(), 'foo', {persist_to: 1, replicate_to: 0}, function() {
        done();
      });
    });

    it('durability should propagate errors', function (done) {
      H.b.replace(H.key(), 'bar', {persist_to: 1, replicate_to: 0},
        function (err, res) {
          assert(err);
          done();
        });
    });

    it('should return from replace with 0 expiry (slow)', function(done) {
      this.timeout(3000);
      var key = H.key();
      H.b.insert(key, 'bar', {expiry:1}, H.okCallback(function(insertRes) {
        H.b.replace(key, 'foo', {expiry:0}, H.okCallback(function (replaceRes) {
          setTimeout(function () {
            H.b.get(key, H.okCallback(function (getRes) {
              assert(getRes);
              done();
            }));
          }, 2000);
        }));
      }));
    });
  }

  describe('#RealBucket', allTests.bind(this, harness));
  describe('#MockBucket', allTests.bind(this, harness.mock));
});
