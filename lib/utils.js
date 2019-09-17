const qs = require('querystring');

/**
 * @private
 */
class Utils {
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
      if (values.hasOwnProperty(i)) {
        if (typeof values[i] === 'boolean') {
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
