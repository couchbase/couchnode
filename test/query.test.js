'use strict';

var assert = require('assert');
var harness = require('./harness.js');

var Vq = harness.lib.ViewQuery;

describe('#Querying', function() {
  function allTests(H) {
    describe('#View Queries', function () {
      it('should set ddoc/name properly', function () {
        var q = Vq.from('d', 'v');
        assert.equal(q.ddoc, 'd');
        assert.equal(q.name, 'v');
      });
      it('should set stale to ok properly', function () {
        var q = Vq.from('d', 'v').stale(Vq.Update.NONE);
        assert.equal(q.options.stale, 'ok');
      });
      it('should set stale to false properly', function () {
        var q = Vq.from('d', 'v').stale(Vq.Update.BEFORE);
        assert.equal(q.options.stale, 'false');
      });
      it('should set stale to update_after properly', function () {
        var q = Vq.from('d', 'v').stale(Vq.Update.AFTER);
        assert.equal(q.options.stale, 'update_after');
      });
      it('should fail with incorrect stale parameter', function () {
        assert.throws(function () {
          Vq.from('d', 'v').stale('foo');
        }, TypeError);
      });
      it('should set skip properly', function () {
        var q = Vq.from('d', 'v').skip(11);
        assert.equal(q.options.skip, 11);
      });
      it('should set limit properly', function () {
        var q = Vq.from('d', 'v').limit(11);
        assert.equal(q.options.limit, 11);
      });
      it('should work with ascending order', function () {
        var q = Vq.from('d', 'v').order(Vq.Order.DESCENDING);
        assert.equal(q.options.descending, true);
      });
      it('should work with ascending order', function () {
        var q = Vq.from('d', 'v').order(Vq.Order.ASCENDING);
        assert.equal(q.options.descending, false);
      });
      it('should fail with incorrect order parameter', function () {
        assert.throws(function () {
          Vq.from('d', 'v').order('foo');
        }, TypeError);
      });
      it('should work with reduce as true', function () {
        var q = Vq.from('d', 'v').reduce(true);
        assert.equal(q.options.reduce, true);
      });
      it('should work with reduce as false', function () {
        var q = Vq.from('d', 'v').reduce(false);
        assert.equal(q.options.reduce, false);
      });
      it('should work with grouping off', function () {
        var q = Vq.from('d', 'v').group(-1);
        assert.equal(q.options.group, true);
        assert.equal(q.options.group_level, 0);
      });
      it('should work with key', function () {
        var q = Vq.from('d', 'v').key('test1');
        assert.equal(q.options.key, '"test1"');
      });
      it('should work with keys', function () {
        var q = Vq.from('d', 'v').keys(['test1', 'test2']);
        assert.equal(q.options.keys, '["test1","test2"]');
      });
      it('should work with grouping set', function () {
        var q = Vq.from('d', 'v').group(3);
        assert.equal(q.options.group, false);
        assert.equal(q.options.group_level, 3);
      });
      it('should work with range begin', function () {
        var q = Vq.from('d', 'v').range('test1');
        assert.equal(q.options.startkey, '"test1"');
        assert.equal(q.options.endkey, undefined);
        assert.equal(q.options.inclusive_end, undefined);
      });
      it('should work with range end', function () {
        var q = Vq.from('d', 'v').range(undefined, 'test1');
        assert.equal(q.options.startkey, undefined);
        assert.equal(q.options.endkey, '"test1"');
        assert.equal(q.options.inclusive_end, undefined);
      });
      it('should work with range between', function () {
        var q = Vq.from('d', 'v').range('test1', 'test2');
        assert.equal(q.options.startkey, '"test1"');
        assert.equal(q.options.endkey, '"test2"');
        assert.equal(q.options.inclusive_end, undefined);
      });
      it('should work with inclusive end', function () {
        var q = Vq.from('d', 'v').range('test1', 'test2', true);
        assert.equal(q.options.startkey, '"test1"');
        assert.equal(q.options.endkey, '"test2"');
        assert.equal(q.options.inclusive_end, 'true');
      });
      it('should work with id range begin', function () {
        var q = Vq.from('d', 'v').id_range('test1');
        assert.equal(q.options.startkey_docid, 'test1');
        assert.equal(q.options.endkey_docid, undefined);
      });
      it('should work with id range end', function () {
        var q = Vq.from('d', 'v').id_range(undefined, 'test1');
        assert.equal(q.options.startkey_docid, undefined);
        assert.equal(q.options.endkey_docid, 'test1');
      });
      it('should work with id range between', function () {
        var q = Vq.from('d', 'v').id_range('test1', 'test2');
        assert.equal(q.options.startkey_docid, 'test1');
        assert.equal(q.options.endkey_docid, 'test2');
      });
      it('should work with full_set (default)', function () {
        var q = Vq.from('d', 'v').full_set();
        assert.equal(q.options.full_set, 'true');
      });
      it('should work with full_set', function () {
        var q = Vq.from('d', 'v').full_set(true);
        assert.equal(q.options.full_set, 'true');
      });
      it('should work with on_error stop', function () {
        var q = Vq.from('d', 'v').on_error(Vq.ErrorMode.STOP);
        assert.equal(q.options.on_error, 'stop');
      });
      it('should work with on_error continue', function () {
        var q = Vq.from('d', 'v').on_error(Vq.ErrorMode.CONTINUE);
        assert.equal(q.options.on_error, 'continue');
      });
      it('should set custom options properly', function () {
        var q = Vq.from('d', 'v').custom({x: 4, y: 'hi'});
        assert.equal(q.options.x, 4);
        assert.equal(q.options.y, 'hi');
      });
      it('should work for spatial queries', function () {
        var q = Vq.fromSpatial('d', 'v').bbox([1, 2, 3, 4]);
        assert.equal(q.options.bbox, '1,2,3,4');
      });
    });
    describe('#View Queries (slow)', function () {
      var key = H.key();
      var ddKey = H.key();
      var bm = H.b.manager();
      before(function (done) {
        this.timeout(6000);
        bm.insertDesignDocument(ddKey, {
          views: {
            simple: {
              map: 'function(doc, meta){emit(meta.id);}'
            }
          },
          spatial: {
            'simpleGeo': 'function(doc, meta){emit({type:"Point",coordinates:doc.loc},[meta.id, doc.loc]);}'
          }
        }, function (err, res) {
          assert(!err);
          assert(res);
          H.b.insert(key, 'foo', H.okCallback(function() {
            setTimeout(function () {
              H.b.query(
                  Vq.from(ddKey, 'simple').stale(Vq.Update.BEFORE).limit(1),
                  function (err) {
                    assert(!err);
                    done();
                  });
            }, 3000);
          }));
        });
      });
      after(function (done) {
        H.b.remove(key, H.okCallback(function() {
          bm.removeDesignDocument(ddKey, function (err, res) {
            assert(!err);
            assert(res);
            done();
          });
        }));
      });

      it('should fail for invalid query objects', function () {
        assert.throws(function () {
          H.b.query({}, H.noCallback())
              .on('row', H.noCallback())
              .on('rows', H.noCallback())
              .on('end', H.noCallback())
              .on('error', H.noCallback());
        }, TypeError);
      });
      it('view queries should callback', function (done) {
        H.b.query(Vq.from(ddKey, 'simple').limit(1),
            function (err, res, meta) {
              assert(!err);
              assert(res);
              assert(meta);
              assert(meta.total_rows > 0);
              done();
            });
      });

      it('view queries should callback on error', function (done) {
        H.b.query(Vq.from(ddKey, 'no_exist_view').limit(1),
            function (err, res) {
              assert(err);
              assert(!res);
              done();
            });
      });

      it('view queries should emit individual rows', function (done) {
        var rowCount = 0;
        H.b.query(Vq.from(ddKey, 'simple').limit(1))
            .on('row', function (row) {
              assert(row);
              rowCount++;
            }).on('end', function () {
              assert(rowCount > 0);
              done();
            }).on('error', function () {
              assert();
            });
      });

      it('view queries should emit a rows events', function (done) {
        H.b.query(Vq.from(ddKey, 'simple').limit(1))
            .on('rows', function (rows, meta) {
              assert(rows);
              assert(meta);
              assert(meta.total_rows > 0);
              done();
            }).on('error', function () {
              assert();
            });
      });

      it('view queries should be able to emit all events', function (done) {
        var rowCount = 0;
        var rowsMeta = null;
        H.b.query(Vq.from(ddKey, 'simple').limit(1))
            .on('row', function (row) {
              assert(row);
              rowCount++;
            }).on('rows', function (rows, meta) {
              assert(rows);
              assert(meta);
              assert(meta.total_rows > 0);
              rowsMeta = meta;
            }).on('end', function (meta) {
              assert(rowCount > 0);
              assert(meta, rowsMeta);
              done();
            }).on('error', function () {
              assert();
            });
      });

      it('view queries should emit an error event with a row handler',
          function (done) {
            H.b.query(Vq.from(ddKey, 'no_exist_view').limit(1))
                .on('row', function (rows) {
                  // Do Nothing
                }).on('error', function (err) {
                  assert(err);
                  done();
                });
          });

      it('view queries should emit an error event with a rows handler',
          function (done) {
            H.b.query(Vq.from(ddKey, 'no_exist_view').limit(1))
                .on('rows', function (rows) {
                  // Do Nothing
                }).on('error', function (err) {
                  assert(err);
                  done();
                });
          });

      /*
       * Disabled because Couchbase Server isn't allowing it to work
       *   properly at the moment...
       */
      it.skip('spatial queries should work', function (done) {
        this.timeout(4000);
        H.b.query(Vq.fromSpatial(ddKey, 'simpleGeo'),
            function (err, rows, meta) {
              assert(!err);
              assert(rows);
              assert(meta);
              done();
            });
      });
    });
  }

  describe('#RealBucket', allTests.bind(this, harness));
  describe('#MockBucket', allTests.bind(this, harness.mock));
});
