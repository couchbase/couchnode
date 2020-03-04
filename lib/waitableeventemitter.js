'use strict';

const events = require('events');

/**
 * @private
 */
const PromiseState = {
  REJECTED: -1,
  PENDING: 0,
  FULLFILLED: 1,
};

/**
 * @private
 */
class WaitableEventEmitter extends events.EventEmitter {
  constructor() {
    super();

    this._state = PromiseState.PENDING;
    this._result = null;

    this._handlersRegistered = false;
    this._handlers = [];
  }

  then(onFullfill, onReject) {
    if (!this._handlersRegistered) {
      const resolveHandlers = () => {
        if (this._state === PromiseState.FULLFILLED) {
          this._handlers.forEach((fns) => {
            if (fns.onFullfill) {
              fns.onFullfill(this._result);
            }
          });
          this._handlers = [];
        } else if (this._state === PromiseState.REJECTED) {
          this._handlers.forEach((fns) => {
            if (fns.onReject) {
              fns.onReject(this._result);
            }
          });
          this._handlers = [];
        } else {
          throw new Error(
            'WaitableEventEmitter attempted to run handlers without resolution'
          );
        }
      };

      this.on('success', (result) => {
        if (this._state !== PromiseState.PENDING) {
          throw new Error('WaitableEventEmitter emitted multiple results');
        }

        this._state = PromiseState.FULLFILLED;
        this._result = result;

        resolveHandlers();
      });

      this.on('error', (err) => {
        if (this._state !== PromiseState.PENDING) {
          throw new Error('WaitableEventEmitter emitted multiple results');
        }

        this._state = PromiseState.REJECTED;
        this._result = err;

        resolveHandlers();
      });

      this._handlersRegistered = true;
    }

    if (this._state === PromiseState.FULLFILLED) {
      setImmediate(() => onFullfill(this._result));
      return Promise.resolve(this._result);
    } else if (this._state === PromiseState.REJECTED) {
      setImmediate(() => onReject(this._result));
      return Promise.reject(this._result);
    }

    this._handlers.push({
      onFullfill: onFullfill,
      onReject: onReject,
    });
    return this;
  }

  catch(onReject) {
    return this.then(null, onReject);
  }
  finally(onFinally) {
    const handler = () => onFinally();
    return this.then(handler, handler);
  }
}

module.exports = WaitableEventEmitter;
