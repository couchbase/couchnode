'use strict';

function unpackArgs(first, args, first_index) {
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
module.exports.unpackArgs = unpackArgs;
