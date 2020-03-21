'use strict';

var assert = require('assert');
var uuid = require('uuid');
var harness = require('./harness');
var testdata = require('./testdata');

var H = harness;
var Nq = harness.lib.N1qlQuery;

function checkQueryOpts(q, params, res) {
  var qobj = q.toObject(params);
  assert.deepEqual(qobj, res);
}

describe('#n1ql', function() {
  describe('#N1QL Queries', function() {
    it('should create queries correctly', function() {
      var q = Nq.fromString('SELECT * FROM default');
      checkQueryOpts(q, null, {
        statement: 'SELECT * FROM default',
      });
    });

    it('should set query consistency correctly', function() {
      var q1 = Nq.fromString('SELECT * FROM default').consistency(
        Nq.Consistency.NOT_BOUNDED
      );
      checkQueryOpts(q1, null, {
        statement: 'SELECT * FROM default',
        scan_consistency: 'not_bounded',
      });

      var q2 = Nq.fromString('SELECT * FROM default').consistency(
        Nq.Consistency.REQUEST_PLUS
      );
      checkQueryOpts(q2, null, {
        statement: 'SELECT * FROM default',
        scan_consistency: 'request_plus',
      });

      var q3 = Nq.fromString('SELECT * FROM default').consistency(
        Nq.Consistency.STATEMENT_PLUS
      );
      checkQueryOpts(q3, null, {
        statement: 'SELECT * FROM default',
        scan_consistency: 'statement_plus',
      });
    });

    it('should set query pretty correctly', function() {
      var q1 = Nq.fromString('SELECT * FROM default').pretty(true);
      checkQueryOpts(q1, null, {
        statement: 'SELECT * FROM default',
        pretty: true,
      });
    });

    it('should set query scanCap correctly', function() {
      var q1 = Nq.fromString('SELECT * FROM default').scanCap(114);
      checkQueryOpts(q1, null, {
        statement: 'SELECT * FROM default',
        scan_cap: 114,
      });
    });

    it('should set query pipelineBatch correctly', function() {
      var q1 = Nq.fromString('SELECT * FROM default').pipelineBatch(241);
      checkQueryOpts(q1, null, {
        statement: 'SELECT * FROM default',
        pipeline_batch: 241,
      });
    });

    it('should set query pipelineCap correctly', function() {
      var q1 = Nq.fromString('SELECT * FROM default').pipelineCap(998);
      checkQueryOpts(q1, null, {
        statement: 'SELECT * FROM default',
        pipeline_cap: 998,
      });
    });

    it('should set query readonly correctly', function() {
      var q1 = Nq.fromString('SELECT * FROM default').readonly(true);
      checkQueryOpts(q1, null, {
        statement: 'SELECT * FROM default',
        readonly: true,
      });
    });

    it('should set query profile correctly', function() {
      var q1 = Nq.fromString('SELECT * FROM default').profile(
        Nq.ProfileType.PROFILE_TIMINGS
      );
      checkQueryOpts(q1, null, {
        statement: 'SELECT * FROM default',
        profile: 'timings',
      });
    });

    it('should set query raw parameters correctly', function() {
      var q1 = Nq.fromString('SELECT * FROM default').rawParam('test', [
        'this-is-a-test',
        2,
      ]);
      checkQueryOpts(q1, null, {
        statement: 'SELECT * FROM default',
        test: ['this-is-a-test', 2],
      });
    });
  });

  describe('#N1QL Queries (slow)', function() {
    H.requireFeature(H.Features.N1ql, function() {
      var testUid = uuid.v4();

      it('should set up some test data successfully', function(done) {
        testdata.upsertData(H.b, testUid, done);
      });

      it('should ensure a primary index exists', function(done) {
        var q = Nq.fromString('CREATE PRIMARY INDEX ON ' + H.b.name);
        H.b.query(q, function() {
          done();
        });
      });

      it('should see test data correctly', function(done) {
        this.timeout(10000);

        function checkForTestData() {
          var q = Nq.fromString(
            'SELECT * FROM ' + H.b.name + ' WHERE testUid="' + testUid + '"'
          );
          H.b.query(q, function(err, rows) {
            if (err || rows.length !== testdata.docCount()) {
              // If the data isn't there yet, schedule a wait and try again
              setTimeout(checkForTestData, 100);
              return;
            }

            done();
          });
        }
        checkForTestData();
      });

      it('should work with parameters', function(done) {
        var q = Nq.fromString(
          'SELECT * FROM ' + H.b.name + ' WHERE testUid=? AND x=?'
        );
        H.b.query(
          q,
          [testUid, 1],
          H.okCallback(function(rows) {
            assert.equal(rows.length, 3);
            done();
          })
        );
      });
    });
  });
});
