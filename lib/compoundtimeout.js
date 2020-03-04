'use strict';

/**
 * @private
 */
class CompoundTimeout {
  constructor(timeout) {
    this.start = process.hrtime();
    this.timeout = timeout;
  }

  left() {
    if (this.timeout === undefined) {
      return undefined;
    }

    var period = process.hrtime(this.start);

    var periodMs = period[0] * 1e3 + period[1] / 1e6;
    if (periodMs > this.timeout) {
      return 0;
    }

    return this.timeout - periodMs;
  }

  expired() {
    if (this.timeout === undefined) {
      return false;
    }

    return this.left() <= 0;
  }
}
module.exports = CompoundTimeout;
