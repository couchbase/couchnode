const PromiseHelper = require('./promisehelper');
const HttpExecutor = require('./httpexecutor');

class ViewIndexManager
{
    /**
     * 
     * @param {*} conn 
     * @private
     */
    constructor(bucket) {
        this._bucket = bucket;
    }

    get _http() {
        return new HttpExecutor(this._bucket._conn);
    }

    async getDesignDocuments(callback) {
        return PromiseHelper.wrap(async () => {
            const bucketName = this._bucket.name;

            var res = await this._http.request({
                type: 'MGMT',
                method: 'GET',
                path: `pools/default/buckets/${bucketName}/ddocs`,
            });

            if (res.statusCode !== 200) {
                // TODO: Error handling...
                throw new Error('failed to get design documents');
            }

            var ddocData = JSON.parse(res.body);
            var ddocs = {};
            for (var i = 0; i < ddocData.rows.length; ++i) {
                var ddoc = ddocData.rows[i].doc;
                var ddocName = ddoc.meta.id.substr(8);
                ddocs[ddocName] = ddoc.json;
            }
      
            return ddocs;
        }, callback);
    }

    async getDesignDocument(designDoc, callback) {
        return PromiseHelper.wrap(async () => {
            var res = await this._http.request({
                type: 'VIEW',
                method: 'GET',
                path: `_design/${designDoc}`,
            });

            if (res.statusCode === 404) {
                // Request was successful, but the design document does
                // not actually exist...
                return null;
            }

            if (res.statusCode !== 200) {
                // TODO: Error handling...
                throw new Error('failed to get design document');
            }

            return JSON.parse(res.body);
        }, callback);
    }

    async upsertDesignDocument(designDoc, data, callback) {
        return PromiseHelper.wrap(async () => {
            var encodedData = JSON.stringify(data, (k, v) => {
                if (v instanceof Function) {
                    return v.toString();
                }
                return v;
            });

            var res = await this._http.request({
                type: 'VIEW',
                method: 'PUT',
                path: `_design/${designDoc}`,
                contentType: 'application/json',
                body: encodedData,
            });

            if (res.statusCode !== 201) {
                // TODO: Error handling...
                throw new Error('failed to upsert design documents');
            }

            return true;
        }, callback);
    }

    async insertDesignDocument(designDoc, data, callback) {
        return PromiseHelper.wrap(async () => {
            var res = await this.getDesignDocument(designDoc);
            if (res) {
                // TODO: Improve this error...
                throw new Error('design document already exists');
            }

            return this.upsertDesignDocument(designDoc, data);
        }, callback);
    }

    async removeDesignDocument(designDoc, callback) {
        return PromiseHelper.wrap(async () => {
            var res = await this._http.request({
                type: 'VIEW',
                method: 'DELETE',
                path: `_design/${designDoc}`,
            });

            if (res.statusCode !== 200) {
                // TODO: Error handling...
                throw new Error('failed to remove design document');
            }

            return true;
        }, callback);
    }
}
module.exports = ViewIndexManager;
