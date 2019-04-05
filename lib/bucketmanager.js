const PromiseHelper = require('./promisehelper');
const HttpExecutor = require('./httpexecutor');

class BucketManager
{
    /**
     * 
     * @param {*} conn 
     * @private
     */
    constructor(cluster) {
        this._cluster = cluster;
    }

    get _http() {
        return new HttpExecutor(this._cluster._getClusterConn());
    }

    /**
     * 
     * @param {string} bucketName 
     */
    async flush(bucketName, callback) {
        return PromiseHelper.wrap(async () => {
            var res = await this._http.request({
                type: 'MGMT',
                method: 'POST',
                path: `pools/default/buckets/${bucketName}/controller/doFlush`,
            });

            if (res.statusCode !== 200) {
                // TODO: Error handling...
                throw new Error('failed to flush bucket');
            }

            return true;
        }, callback);
    }
}
module.exports = BucketManager;
