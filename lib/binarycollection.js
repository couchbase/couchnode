class BinaryCollection
{
    constructor(collection) {
        this._coll = collection;
    }

    /**
     * @typedef {Object} ArithmeticResult
     * @property {integer} value
     * @property {Cas} cas
     * @property {MutationToken} [mutationToken]
     */
    /**
     * @typedef {function(Error, ArithmeticResult)} ArithmeticCallback
     */
    /**
     * 
     * @param {string} key 
     * @param {integer} value 
     * @param {*} options 
     * @param {integer} [options.timeout]
     * @param {ArithmeticCallback} callback 
     * @returns {Promise<ArithmeticResult>}
     */
    increment(key, value, options, callback) {
        return this._coll._binaryIncrement(key, value, options, callback);
    }
    /**
     * 
     * @param {string} key 
     * @param {integer} value 
     * @param {*} options
     * @param {integer} [options.timeout]
     * @param {ArithmeticCallback} callback 
     * @returns {Promise<ArithmeticResult>}
     */
    decrement(key, value, options, callback) {
        return this._coll._binaryDecrement(key, value, options, callback);
    }

    /**
     * @typedef {Object} AdjoinResult
     * @property {Cas} cas
     * @property {MutationToken} [mutationToken]
     */
    /**
     * @typedef {function(Error, AdjoinResult)} AdjoinCallback
     */
    /**
     * 
     * @param {string} key 
     * @param {Buffer} value 
     * @param {*} options
     * @param {integer} [options.timeout]
     * @param {AdjoinCallback} callback 
     * @returns {Promise<AdjoinResult>}
     */
    append(key, value, options, callback) {
        return this._coll._binaryAppend(key, value, options, callback);
    }
    /**
     * 
     * @param {string} key 
     * @param {Buffer} value 
     * @param {*} options
     * @param {integer} [options.timeout]
     * @param {AdjoinCallback} callback 
     * @returns {Promise<AdjoinResult>}
     */
    prepend(key, value, options, callback) {
        return this._coll._binaryPrepend(key, value, options, callback);
    }
}

module.exports = BinaryCollection;
