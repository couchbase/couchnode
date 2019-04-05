const PromiseHelper = require('./promisehelper');
const HttpExecutor = require('./httpexecutor');

class QueryIndexManager
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

    async _createIndex(options, callback) {
        // TODO: Check parameters

        return PromiseHelper.wrap(async () => {
            const bucketName = this._bucket.name;

            var qs = '';

            if (options.fields.length === 0) {
                qs += 'CREATE PRIMARY INDEX';
            } else {
                qs += 'CREATE INDEX';
            }

            if (options.name) {
                qs += ' `' + options.name + '`';
            }

            qs += ' ON `' + bucketName + '`';

            if (options.fields && options.fields.length > 0) {
                qs += '(';
                for (var i = 0; i < options.fields.length; ++i) {
                    if (i > 0) {
                        qs += ', ';
                    }

                    qs += '`' + options.fields[i] + '`';
                }
                qs += ')';
            }

            if (options.deferred) {
                qs += ' WITH {"defer_build: true}';
            }

            try {
                await this._bucket.query(qs);
                return true;
            } catch (err) {
                if (options.ignoreIfExists) {
                    if (err.message.indexOf('already exist') >= 0) {
                        return true;
                    }
                }

                throw err;
            }
        }, callback);
    }

    async createIndex(indexName, fields, options, callback) {
        if (options instanceof Function) {
            callback = arguments[2];
            options = undefined;
        }
        if (!options) {
            options = {};
        }

        return PromiseHelper.wrap(async () => {
            return this._createIndex({
                name: indexName,
                fields: fields,
                ignoreIfExists: options.ignoreIfExists,
                deferred: options.deferred,
            });
        }, callback);
    }

    async createPrimaryIndex(options, callback) {
        if (options instanceof Function) {
            callback = arguments[0];
            options = undefined;
        }
        if (!options) {
            options = {};
        }

        return PromiseHelper.wrap(async () => {
            return this._createIndex({
                name: options.name,
                ignoreIfExists: options.ignoreIfExists,
                deferred: options.deferred,
            });
        }, callback);
    }

    async _dropIndex(options, callback) {
        // TODO: Check parameters

        return PromiseHelper.wrap(async () => {
            const bucketName = this._bucket.name;

            var qs = '';

            if (!options.name) {
                qs += 'DROP PRIMARY INDEX `' + bucketName + '`';
            } else {
                qs += 'DROP INDEX `' + bucketName + '`.`' + options.name + '`';
            }

            try {
                await this._bucket.query(qs);
                return true;
            } catch (err) {
                if (options.ignoreIfNotExists) {
                    if (err.message.indexOf('not found') >= 0) {
                        return true;
                    }
                }

                throw err;
            }
        }, callback);
    }

    async dropIndex(indexName, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }

        return PromiseHelper.wrap(async () => {
            return this._dropIndex({
                name: indexName,
                ignoreIfNotExists: options.ignoreIfNotExists,
            });
        }, callback);
    }

    async dropIndex(options, callback) {
        if (options instanceof Function) {
            callback = arguments[0];
            options = undefined;
        }
        if (!options) {
            options = {};
        }

        return PromiseHelper.wrap(async () => {
            return this._dropIndex({
                name: options.name,
                ignoreIfNotExists: options.ignoreIfNotExists,
            });
        }, callback);
    }

    async list(callback) {
        return PromiseHelper.wrap(async () => {
            const bucketName = this._bucket.name;

            var qs = '';
            qs += 'SELECT idx.* FROM system:indexes AS idx';
            qs += ' WHERE keyspace_id="' + bucketName + '"';
            qs += ' AND `using`="gsi" ORDER BY is_primary DESC, name ASC';
            
            var res = this._bucket.query(qs);
            // TODO: Maybe transform the results?
            return res;
        }, callback);
    }

    async buildDeferred(callback) {
        return PromiseHelper.wrap(async () => {
            const bucketName = this._bucket.name;

            var indices = await this.list();
            
            var deferredList = [];
            for (var i = 0; i < indices.length; ++i) {
                var index = indices[i];

                if (index.state === 'deferred' || index.state === 'pending') {
                    deferredList.push(index.name);
                }
            }

            // If there are no deferred indexes, we have nothing to do.
            if (!deferredList) {
                return [];
            }

            var qs = '';
            qs += 'BUILD INDEX ON `' + bucketName + '` ';
            qs += '(';
            for (var j = 0; j < deferredList.length; ++j) {
                if (j > 0) {
                    qs += ', ';
                }
                qs += '`' + deferredList[j] + '`';
            }
            qs += ')';

            // Run our deferred build query
            await this._bucket.query(qs);

            // Return the list of indices that we built
            return deferredList;
        }, callback);
    }

    // TODO: Implement watch indexes
}
module.exports = QueryIndexManager;
