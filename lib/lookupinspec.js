const binding = require('./binding');

var DOCUMENT_EXPIRY_MARKER = {};

/**
 * 
 */
class LookupInSpec {
    /**
     * 
     */
    constructor() {
        this._op = -1;
        this._path = '';
        this._flags = 0;
    }

    static get Expiry() { return DOCUMENT_EXPIRY_MARKER; };

    static _create(opType, path, options) {
        if (!options) {
            options = {};
        }

        var flags = 0;

        if (path === DOCUMENT_EXPIRY_MARKER) {
            path = '${document.expiry}';
            flags |= binding.LCB_SUBDOCOPS_F_XATTR_MACROVALUES;
        }

        var spec = new LookupInSpec();
        
        spec._op = opType;
        spec._path = path;
        spec._flags = flags;
    
        return spec;
    }

    /**
     * 
     * @param {string} path 
     * @param {*} [options]
     * @throws InvalidPathError
     * @returns LookupInSpec
     */
    static get(path, options) {
        return this._create(
            binding.LCBX_SDCMD_GET, path, options);
    }

    /**
     * 
     * @param {string} path 
     * @param {*} [options]
     * @throws InvalidPathError
     * @returns LookupInSpec
     */
    static exists(path, options) {
        return this._create(
            binding.LCBX_SDCMD_EXISTS, path, options);
    }

    /**
     * 
     * @param {string} path 
     * @param {*} [options]
     * @throws InvalidPathError
     * @returns LookupInSpec
     */
    static count(path, options) {
        return this._create(
            binding.LCBX_SDCMD_GET_COUNT, path, options);
    }

}

module.exports = LookupInSpec;
