const binding = require('./binding');

// TODO: Document this...
class CasPlaceholder {}

/**
 * 
 */
class MutateInSpec {
    /**
     * 
     */
    constructor() {
        this._op = -1;
        this._path = '';
        this._flags = 0;
        this._data = undefined;
    }

    static _create(opType, path, value, options) {
        if (!options) {
            options = {};
        }

        var spec = new MutateInSpec();
    
        spec._op = opType;
        spec._path = path;
        spec._flags = 0;
        spec._data = value;
    
        if (value === CasPlaceholder) {
            spec._flags |= SDSPEC_F_XATTR_MACROVALUES;
            spec._data = '${document.cas}';
        }
    
        if (options.createPath) {
            spec._flags |= binding.LCB_SDSPEC_F_MKINTERMEDIATES;
        }
    
        if (options.xattr) {
            spec._flags |= SDSPEC_F_XATTRPATH;
            spec._path = options.xattr + '.' + spec._path;
        }
    
        return spec;
    }

    /**
     * 
     * @param {string} path 
     * @param {*} value
     * @param {*} [options]
     * @param {boolean} [options.createPath]
     * @throws InvalidPathError
     * @returns MutateInSpec
     */
    static insert(path, value, options) {
        return this._create(
            binding.LCBX_SDCMD_DICT_ADD, path, value, options);
    }

    /**
     * 
     * @param {string} path 
     * @param {*} value
     * @param {*} [options]
     * @param {boolean} [options.createPath]
     * @throws InvalidPathError
     * @returns MutateInSpec
     */
    static upsert(path, value, options) {
        return this._create(
            binding.LCBX_SDCMD_DICT_UPSERT, path, value, options);
    }

    /**
     * 
     * @param {string} path 
     * @param {*} value
     * @param {*} [options]
     * @param {boolean} [options.createPath]
     * @throws InvalidPathError
     * @returns MutateInSpec
     */
    static replace(path, value, options) {
        return this._create(
            binding.LCBX_SDCMD_REPLACE, path, value, options);
    }

    /**
     * 
     * @param {string} path 
     * @param {*} [options]
     * @throws InvalidPathError
     * @returns MutateInSpec
     */
    static remove(path, options) {
        return this._create(
            binding.LCBX_SDCMD_REMOVE, path, undefined, options);
    }

    /**
     * 
     * @param {string} path 
     * @param {*} value
     * @param {*} [options]
     * @param {boolean} [options.createPath]
     * @throws InvalidPathError
     * @returns MutateInSpec
     */
    static arrayAppend(path, value, options) {
        return this._create(
            binding.LCBX_SDCMD_ARRAY_ADD_LAST, path, value, options);
    }

    /**
     * 
     * @param {string} path 
     * @param {*} value
     * @param {*} [options]
     * @param {boolean} [options.createPath]
     * @throws InvalidPathError
     * @returns MutateInSpec
     */
    static arrayPrepend(path, value, options) {
        return this._create(
            binding.LCBX_SDCMD_ARRAY_ADD_FIRST, path, value, options);
    }

    /**
     * 
     * @param {string} path 
     * @param {*} value
     * @param {*} [options]
     * @param {boolean} [options.createPath]
     * @throws InvalidPathError
     * @returns MutateInSpec
     */
    static arrayInsert(path, value, options) {
        return this._create(
            binding.LCBX_SDCMD_ARRAY_INSERT, path, value, options);
    }

    /**
     * 
     * @param {string} path 
     * @param {*} value
     * @param {*} [options]
     * @param {boolean} [options.createPath]
     * @throws InvalidPathError
     * @returns MutateInSpec
     */
    static arrayAddUnique(path, value, options) {
        return this._create(
            binding.LCBX_SDCMD_ARRAY_ADD_UNIQUE, path, value, options);
    }

    /**
     * 
     * @param {string} path 
     * @param {integer} value
     * @param {*} [options]
     * @param {boolean} [options.createPath]
     * @throws InvalidPathError
     * @returns MutateInSpec
     */
    static increment(path, value, options) {
        return this._create(
            binding.LCBX_SDCMD_COUNTER, path, +value, options);
    }

    /**
     * 
     * @param {string} path 
     * @param {integer} value
     * @param {*} [options]
     * @param {boolean} [options.createPath]
     * @throws InvalidPathError
     * @returns MutateInSpec
     */
    static decrement(path, value, options) {
        return this._create(
            binding.LCBX_SDCMD_COUNTER, path, -value, options);
    }

}

// TODO: Document this properly.
MutateInSpec.CasPlaceholder = CasPlaceholder;

module.exports = MutateInSpec;
