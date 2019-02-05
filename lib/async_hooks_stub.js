var nodeMajorVersion = parseInt(process.versions.node);

if (nodeMajorVersion > 8) {
  var async_hooks = require('async_hooks');
  async_hooks.supported = true;
  module.exports = async_hooks;
} else {
  function AsyncResource() {}
  AsyncResource.prototype.runInAsyncScope = function(fn, thisArg) {
    var args = [];
    for (var i = 2; i < arguments.length; ++i) {
      args.push(arguments[i]);
    }
    return fn.apply(thisArg, args);
  };

  var async_hooks = {};
  async_hooks.AsyncResource = AsyncResource;
  async_hooks.supported = false;
  module.exports = async_hooks;
}
