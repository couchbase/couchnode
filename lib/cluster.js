const AnalyticsExecutor = require('./analyticsexecutor');
const Bucket = require('./bucket');
const BucketManager = require('./bucketmanager');
const Connection = require('./connection');
const N1qlExecutor = require('./n1qlexecutor');
const PromiseHelper = require('./promisehelper');
const SearchExecutor = require('./searchexecutor');

/**
 * 
 */
class Cluster
{
    /**
     * Creates a new Cluster object for interacting with a Couchbase
     * cluster and performing operations.
     * 
     * @param {*} connStr
     * The connection string of your cluster
     * @param {*} [options]
     * @param {number} [options.username]
     * The RBAC username to use when connecting to the cluster.
     * @param {string} [options.password]
     * The RBAC password to use when connecting to the cluster
     * @param {string} [options.clientCertificate]
     * A client certificate to use for authentication with the server.  Specifying
     * this certificate along with any other authentication method (such as username
     * and password) is an error.
     * @param {string} [options.certificateChain]
     * A certificate chain to use for validating the clusters certificates.
     */
    constructor(connStr, options) {
        // TODO: Clean this up
        /*
        options.username;
        options.password;
        options.clientCertificate;
        options.certificateChain;
        */
       
        this._connStr = connStr;
        
        // TODO: Add support for alternative authentication styles
        this._auth = {
            type: 'rbac',
            username: options.username,
            password: options.password,
        };

        this._conns = {};
    }

    /**
     * @typedef {function(Error, QueryResult)} QueryCallback
     */
    /**
     * 
     * @param {string} query
     * The query string to execute. 
     * @param {Object|Array} [params]
     * @param {*} [options]
     * @param {QueryConsistencyMode} [options.consistency]
     * @param {MutationState} [options.consistentWith]
     * @param {boolean} [options.adhoc]
     * @param {number} [options.scanCap]
     * @param {number} [options.pipelineBatch]
     * @param {number} [options.pipelineCap]
     * @param {boolean} [options.readonly]
     * @param {QueryProfileMode} [options.profile]
     * @param {integer} [options.timeout]
     * @param {QueryCallback} [callback]
     * @throws LotsOfStuff
     * @returns {Promise<QueryResult>}
     */
    async query(query, params, options, callback) {
        if (params instanceof Function) {
            callback = arguments[1];
            params = undefined;
            options = undefined;
        } else if (options instanceof Function) {
            callback = arguments[2];
            options = undefined;
        }
        if (!options) {
            options = {};
        }

        var conn = this._getClusterConn();
        var exec = new N1qlExecutor(conn);
        var emitter = exec.query(query, params, options);

        return PromiseHelper.wrapRowEmitter(emitter, callback);
    }

    /**
     * @typedef {function(Error, AnalyticsQueryResult)} AnalyticsQueryCallback
     */
    /**
     * 
     * @param {string} query
     * The query string to execute. 
     * @param {Object|Array} [params]
     * @param {*} [options]
     * @param {integer} [options.timeout]
     * @param {AnalyticsQueryCallback} [callback]
     * @throws LotsOfStuff
     * @returns {Promise<AnalyticsQueryResult>}
     */
    async queryAnalytics(query, params, options, callback) {
        if (params instanceof Function) {
            callback = arguments[1];
            params = undefined;
            options = undefined;
        } else if (options instanceof Function) {
            callback = arguments[2];
            options = undefined;
        }
        if (!options) {
            options = {};
        }

        var conn = this._getClusterConn();
        var exec = new AnalyticsExecutor(conn);
        var emitter = exec.query(query, params, options);

        return PromiseHelper.wrapRowEmitter(emitter, callback);
    }

    /**
     * @typedef {function(Error, SearchQueryResult)} SearchQueryCallback
     */
    /**
     * 
     * @param {SearchQuery} query 
     * @param {*} options 
     * @param {number} [options.skip]
     * @param {number} [options.limit]
     * @param {boolean} [options.explain]
     * @param {string[]} [options.highlight]
     * @param {string[]} [options.fields]
     * @param {SearchFacet[]} [options.facets]
     * @param {SearchSort} [options.sort]
     * @param {SearchConsistency} [options.consistency]
     * @param {MutationState} [options.consistentWith]
     * @param {number} [options.timeout]
     * @param {SearchQueryCallback} callback 
     * @throws LotsOfStuff
     * @returns {Promise<SearchQueryResult>}
     */
    async querySearch(query, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }

        var conn = this._getClusterConn();
        var exec = new SearchExecutor(conn);
        var emitter = exec.query(query, options);

        return PromiseHelper.wrapRowEmitter(emitter, callback);
    }

    /**
     * Gets a reference to a bucket.
     * 
     * @param {string} bucketName 
     * @throws Never
     * @returns {Bucket}
     */
    bucket(bucketName) {
        return new Bucket(this, bucketName);
    }

    async close() {
        for (var i in this._conns) {
            if (this._conns.hasOwnProperty(i)) {
                this._conns[i].close();
            }
        }
        this._conns = [];

        return true;
    }

    /**
     * Gets a bucket manager for this cluster
     * 
     * @returns {BucketManager}
     */
    buckets() {
        return new BucketManager(this);
    }

    _getClusterConn() {
        var conns = Object.values(this._conns);
        if (conns.length === 0) {
            throw new Error('You must have one open bucket ' + 
                'before you can perform queries.');
        }

        return conns[0];
    }

    _getConn(opts) {
        var connOpts = {
            connStr: this._connStr,
            username: this._auth.username,
            password: this._auth.password,
            bucketName: opts.bucketName
        };

        var connKey = connOpts.bucketName;
        var conn = this._conns[connKey];

        if (!conn) {
            conn = new Connection(connOpts);
            this._conns[connKey] = conn;
        }
        
        return conn;
    }
}

module.exports = Cluster;