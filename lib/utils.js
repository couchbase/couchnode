'use strict';

const qs = require('querystring');
const parseDuration = require('parse-duration');

// add the μs that appear in couchbase metrics.
// versus the 'μs' built-in to parseDuraton which is 0xce 0xbc 0x73
parseDuration[Buffer.from([0xc2, 0xb5, 0x73]).toString()] =
  parseDuration.microsecond;

/**
 * @private
 */
class Utils {
  static msToGoDurationStr(ms) {
    if (ms === undefined) {
      return undefined;
    }

    return ms + 'ms';
  }

  static goDurationStrToMs(str) {
    if (str === undefined) {
      return undefined;
    }

    return parseDuration(str);
  }

  static unpackArgs(first, args, first_index) {
    if (!first_index) {
      first_index = 0;
    }
    if (!Array.isArray(first)) {
      first = [first];
      for (var i = first_index + 1; i < args.length; ++i) {
        first.push(args[i]);
      }
    }
    return first;
  }

  static cbQsStringify(values) {
    var cbValues = {};
    for (var i in values) {
      if (Object.prototype.hasOwnProperty.call(values, i)) {
        if (values[i] === undefined) {
          // skipped
        } else if (typeof values[i] === 'boolean') {
          cbValues[i] = values[i] ? 1 : 0;
        } else {
          cbValues[i] = values[i];
        }
      }
    }
    return qs.stringify(cbValues);
  }
}

module.exports = Utils;
