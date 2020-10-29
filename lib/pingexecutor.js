'use strict';

const errors = require('./errors');
const enums = require('./enums');
const binding = require('./binding');
const PromiseHelper = require('./promisehelper');

/**
 * @private
 */
class PingExecutor {
  constructor(conn) {
    this._conn = conn;
  }

  async ping(options) {
    var serviceFlags = 0;
    if (Array.isArray(options.serviceTypes)) {
      options.serviceTypes.forEach((serviceType) => {
        if (serviceType === enums.ServiceType.KeyValue) {
          serviceFlags |= binding.LCBX_SERVICETYPE_KEYVALUE;
        } else if (serviceType === enums.ServiceType.Views) {
          serviceFlags |= binding.LCBX_SERVICETYPE_VIEWS;
        } else if (serviceType === enums.ServiceType.Query) {
          serviceFlags |= binding.LCBX_SERVICETYPE_QUERY;
        } else if (serviceType === enums.ServiceType.Search) {
          serviceFlags |= binding.LCBX_SERVICETYPE_SEARCH;
        } else if (serviceType === enums.ServiceType.Analytics) {
          serviceFlags |= binding.LCBX_SERVICETYPE_ANALYTICS;
        } else {
          throw new Error('invalid service type');
        }
      });
    }

    return PromiseHelper.wrap((promCb) => {
      this._conn.ping(
        options.reportId,
        serviceFlags,
        options.timeout,
        (err, data) => {
          err = errors.wrapLcbErr(err);
          if (err) {
            return promCb(err);
          }

          var parsedReport = JSON.parse(data);
          promCb(err, parsedReport);
        }
      );
    });
  }
}

module.exports = PingExecutor;
