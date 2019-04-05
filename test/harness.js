const assert = require('chai').assert;
const uuid = require('uuid');
const couchbase = require('../lib/couchbase');
const jcbmock = require('./jcbmock');

const ServerFeatures = {
  KeyValue: 'kv',
  Ssl: 'ssl',
  Views: 'views',
  SpatialViews: 'spatial_views',
  N1ql: 'n1ql',
  Subdoc: 'subdoc',
  Fts: 'fts',
  Analytics: 'analytics',
  Collections: 'collections',
};

class ServerVersion {
  constructor(major, minor, patch, isMock) {
    this.major = major;
    this.minor = minor;
    this.patch = patch;
    this.isMock = isMock;
  }

  isAtLeast(major, minor, patch) {
    if (this.major === 0 && this.minor === 0 && this.patch === 0) {
      // if no version is provided, assume latest
      return true;
    }

    if (major < this.major) {
      return true;
    } else if (major > this.major) {
      return false;
    }

    if (minor < this.minor) {
      return true;
    } else if (minor > this.minor) {
      return false;
    }

    return patch <= this.patch;
  }
}

var TEST_CONFIG = {
  connstr: undefined,
  version: new ServerVersion(0, 0, 0, false),
  bucket: 'default',
  coll: 'test',
  user: undefined,
  pass: undefined,
};

if (process.env.CNCSTR !== undefined) {
  TEST_CONFIG.connstr = process.env.CNCSTR;
}
if (process.env.CNCVER !== undefined) {
  assert(!TEST_CONFIG.connstr, 'must not specify a version without a connstr');
  var ver = process.env.CNCVER;
  var major = semver.major(ver);
  var minor = semver.minor(ver);
  var patch = semver.patch(ver);
  TEST_CONFIG.version = new ServerVersion(major, minor, patch, false);
}
if (process.env.CNBUCKET !== undefined) {
  TEST_CONFIG.bucket = process.env.CNBUCKET;
}
if (process.env.CNCOLL !== undefined) {
  TEST_CONFIG.coll = process.env.CNCOLL;
}
if (process.env.CNUSER !== undefined) {
  TEST_CONFIG.user = process.env.CNUSER;
}
if (process.env.CNPASS !== undefined) {
  TEST_CONFIG.pass = process.env.CNPASS;
}

class Harness {
  get Features() { return ServerFeatures; }

  constructor() {
    this._connstr = TEST_CONFIG.connstr;
    this._version = TEST_CONFIG.version;
    this._bucket = TEST_CONFIG.bucket;
    this._coll = TEST_CONFIG.coll;
    this._user = TEST_CONFIG.user;
    this._pass = TEST_CONFIG.pass;
    this._usingMock = false;

    if (!this._connstr) {
      var mockVer = jcbmock.version();

      this._connstr = 'pending-mock-connect';
      this._version =
        new ServerVersion(mockVer[0], mockVer[1], mockVer[2], true);
      this._usingMock = true;
    }

    this._testKey = uuid.v1().substr(0, 8);
    this._testCtr = 1;

    this._mockInst = null;
    this._testCluster = null;
    this._testBucket = null;
    this._testScope = null;
    this._testColl = null;
    this._testDColl = null;
  }

  async throwsHelper(fn) {
    // TODO: This really should not need to exist...
    var assertArgs = Array.from(arguments).slice(1);

    var savedErr = null;
    try {
      await fn();
    } catch (err) {
      savedErr = err;
    }

    assert.throws(() => {
      if (savedErr) {
        throw err;
      }
    }, ...assertArgs);
  }

  genTestKey() {
    return this._testKey + '_' + this._testCtr++;
  }

  async _createMock() {
    return new Promise((resolve, reject) => {
      jcbmock.create({}, function(err, mock) {
        if (err) {
          reject(err);
          return;
        }

        resolve(mock);
      });
    });
  }

  async prepare() {
    if (this._usingMock) {
      var mockInst = await this._createMock();
      var mockEntryPort = mockInst.entryPort;

      this._mockInst = mockInst;
      this._connstr =
        `http://localhost:${mockEntryPort}`;
    }

    var cluster = new couchbase.Cluster(
      this._connstr, {
        username: this._user,
        password: this._pass,
      });
    var bucket = cluster.bucket(this._bucket);
    var scope = bucket.defaultScope();
    var coll = bucket.collection(this._coll);
    var dcoll = bucket.defaultCollection();

    this._testCluster = cluster;
    this._testBucket = bucket;
    this._testScope = scope;
    this._testColl = coll;
    this._testDColl = dcoll;
  }

  async cleanup() {
    var cluster = this._testCluster;

    this._testCluster = null;
    this._testBucket = null;
    this._testScope = null;
    this._testColl = null;
    this._testDColl = null;

    await cluster.close();

    if (this._mockInst) {
      this._mockInst.close();
      this._mockInst = null;
    }
  }

  sleep(ms) {
    // TODO: Implement time-travelling on the server...
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  supportsFeature(feature) {
    switch (feature) {
      case ServerFeatures.KeyValue:
      case ServerFeatures.Ssl:
      case ServerFeatures.Views:
      case ServerFeatures.SpatialViews:
      case ServerFeatures.Subdoc:
        return true;
      case ServerFeatures.Fts:
      case ServerFeatures.N1ql:
      case ServerFeatures.Analytics:
        // supported on all versions except the mock
        return !this._version.isMock;
      case ServerFeatures.Collections:
        return !this._version.isMock &&
          this._version.isAtLeast(6, 0, 0);
    }

    throw new Error('invalid code for feature checking');
  }

  requireFeature(feature, cb) {
    if (this.supportsFeature(feature)) {
      cb();
    }
  }

  get lib() {
    return couchbase;
  }

  get c() {
    return this._testCluster;
  }
  get b() {
    return this._testBucket;
  }
  get s() {
    return this._testScope;
  }
  get co() {
    return this._testColl;
  }
  get dco() {
    return this._testDColl;
  }

}

var harness = new Harness();

// These are written as normal functions, not async lambdas
// due to our need to specify custom timeouts, which are not
// yet supported on before/after methods yet.
before(function(done) {
  this.timeout(10000);
  harness.prepare().then(done).catch(done);
});
after(function(done) {
  this.timeout(2000);
  harness.cleanup().then(done).catch(done);
});

module.exports = harness;
