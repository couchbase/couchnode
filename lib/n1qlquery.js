'use strict';

var util = require('util');
var qs = require('querystring');

/**
 * Class for dynamically construction of N1QL queries.  This class should never
 * be constructed directly, instead you should use the
 * {@link N1qlQuery.fromString} static method to instantiate a
 * {@link N1qlStringQuery}.
 *
 * @constructor
 *
 * @since 2.0.0
 * @committed
 */
function N1qlQuery() {
}

/**
 * Enumeration for specifying N1QL consistency semantics.
 *
 * @readonly
 * @enum {number}
 */
N1qlQuery.Consistency = {
  /**
   * This is the default (for single-statement requests).
   */
  NOT_BOUNDED: 1,

  /**
   * This implements strong consistency per request.
   */
  REQUEST_PLUS: 2,

  /**
   * This implements strong consistency per statement.
   */
  STATEMENT_PLUS: 3
};

/**
 * Enum representing the different query profiling modes.
 *
 * @readonly
 * @enum {string}
 *
 * @since 2.4.6
 * @committed
 */
N1qlQuery.ProfileType = {
  /**
   * Disables profiling. This is the default
   */
  PROFILE_NONE: 'off',

  /**
   * This enables phase profiling.
   */
  PROFILE_PHASES: 'phases',

  /**
   * This enables general timing profiling.
   */
  PROFILE_TIMINGS: 'timings'
};


/**
 * Returns the fully prepared string representation of this query.
 */
N1qlQuery.prototype.toString = function() {
  throw new Error('Must use N1qlQuery subclasses only.');
};

module.exports = N1qlQuery;


/**
 * Class for holding a explicitly defined N1QL query string.
 *
 * @constructor
 * @extends N1qlQuery
 *
 * @since 2.0.0
 * @committed
 */
function N1qlStringQuery(str) {
  this.options = {
    statement: str
  };
  this.isAdhoc = true;
}
util.inherits(N1qlStringQuery, N1qlQuery);
N1qlQuery.Direct = N1qlStringQuery;

/**
 * Specify the consistency level for this query.
 *
 * @param {N1qlQuery.Consistency} val
 * @returns {N1qlStringQuery}
 *
 * @since 2.0.10
 * @committed
 */
N1qlStringQuery.prototype.consistency = function(val) {
  if (this.options.scan_vectors !== undefined) {
    throw new Error('consistency and consistentWith must be use exclusively.');
  }

  if (val === N1qlQuery.Consistency.NOT_BOUNDED) {
    this.options.scan_consistency = 'not_bounded';
  } else if (val === N1qlQuery.Consistency.REQUEST_PLUS) {
    this.options.scan_consistency = 'request_plus';
  } else if (val === N1qlQuery.Consistency.STATEMENT_PLUS) {
    this.options.scan_consistency = 'statement_plus';
  } else {
    throw new TypeError('invalid option passed.');
  }
  return this;
};

/**
 * Specifies a MutationState object to ensure this query is
 * consistent with.
 *
 * @param state
 *
 * @since 2.1.7
 * @committed
 */
N1qlStringQuery.prototype.consistentWith = function(state) {
  if (this.options.scan_consistency !== undefined) {
    throw new Error('consistency and consistentWith must be use exclusively.');
  }

  this.options.scan_consistency = 'at_plus';
  this.options.scan_vectors = state;
};

/**
 * Specifies whether this query is adhoc or should
 * be prepared.
 *
 * @param {boolean} adhoc
 * @returns {N1qlStringQuery}
 *
 * @since 2.1.0
 * @committed
 */
N1qlStringQuery.prototype.adhoc = function(adhoc) {
  this.isAdhoc = !!adhoc;
  return this;
};

/**
 * Specifies enable/disable formatting a query result
 *
 * @param {boolean} pretty
 * @returns {N1qlStringQuery}
 *
 * @since 2.3.1
 * @committed
 */
N1qlStringQuery.prototype.pretty = function(pretty) {
  this.options.pretty = !!pretty;
  return this;
};

/**
 * Maximum buffered channel size between the indexer client and the query
 * service for index scans. This parameter controls when to use scan backfill.
 * Use 0 or a negative number to disable.
 *
 * @param {number} scanCap
 * @returns {N1qlStringQuery}
 *
 * @since 2.3.8
 * @committed
 */
N1qlStringQuery.prototype.scanCap = function(scanCap) {
  this.options.scan_cap = scanCap.toString();
  return this;
};

/**
 * Controls the number of items execution operators can batch for Fetch
 * from the KV node.
 *
 * @param {number} pipelineBatch
 * @returns {N1qlStringQuery}
 *
 * @since 2.3.8
 * @committed
 */
N1qlStringQuery.prototype.pipelineBatch = function(pipelineBatch) {
  this.options.pipeline_batch = pipelineBatch.toString();
  return this;
};

/**
 * Maximum number of items each execution operator can buffer between
 * various operators.
 *
 * @param {number} pipelineCap
 * @returns {N1qlStringQuery}
 *
 * @since 2.3.8
 * @committed
 */
N1qlStringQuery.prototype.pipelineCap = function(pipelineCap) {
  this.options.pipeline_cap = pipelineCap.toString();
  return this;
};

/**
 * Controls whether a query can change a resulting recordset.  If readonly is
 * true, then only SELECT statements are permitted.
 *
 * @param {boolean} readonly
 * @returns {N1qlStringQuery}
 *
 * @since 2.3.8
 * @committed
 */
N1qlStringQuery.prototype.readonly = function(readonly) {
  this.options.readonly = !!readonly;
  return this;
};

/**
 * Controls the profiling mode used during query execution.
 *
 * @param {N1qlQuery.ProfileType} profileType
 * @returns {N1qlStringQuery}
 *
 * @since 2.4.6
 * @committed
 */
N1qlStringQuery.prototype.profile = function(profileType) {
  this.options.profile = profileType;
  return this;
};

/**
 * Returns the fully prepared string representation of this query.
 */
N1qlStringQuery.prototype.toString = function(args) {
  return qs.stringify(this.toObject(args));
};

/**
 * Returns the fully prepared object representation of this query.
 */
N1qlStringQuery.prototype.toObject = function(args) {
  if (!args) {
    return this.options;
  }

  var out = {};
  for (var i in this.options) {
    if (this.options.hasOwnProperty(i)) {
      out[i] = this.options[i];
    }
  }

  if (Array.isArray(args)) {
    out.args = args;
  } else {
    for (var j in args) {
      if (args.hasOwnProperty(j)) {
        out['$' + j] = args[j];
      }
    }
  }

  return out;
};

/**
 * Creates a query object directly from the passed query string.
 *
 * @param {string} str The N1QL query string.
 * @returns {N1qlStringQuery}
 *
 * @since 2.0.0
 * @committed
 */
N1qlQuery.fromString = function(str) {
  return new N1qlStringQuery(str);
};

/*
function N1qlSelectQuery() {
  this.from = null;
  this.fields = null;
  this.cond = null;
}
util.inherits(N1qlSelectQuery, N1qlQuery);

N1qlQuery.from = function(collection) {
  return (new N1qlSelectQuery()).from(collection);
};

N1qlSelectQuery.prototype.select = function() {
  this.fields = [];
  for (var i = 0; i < arguments.length; ++i) {
    this.fields.push(arguments[i]);
  }
  return this;
};

N1qlSelectQuery.prototype.where = function(expr) {
  this.cond = expr;
  return this;
};

N1qlSelectQuery.prototype.toString = function() {
  var out = '';
  out += 'FROM ';
  out += this.from;
  out += ' SELECT ';
  for (var i = 0; i < this.fields.length; ++i) {
    if (i !== 0) {
      out += ', ';
    }
    out += this.fields[i].toString();
  }
  if (this.cond) {
    out += ' WHERE ';
    out += this.cond.toString();
  }
  return out;
};



var _xReset = function(expr) {
  expr.root = expr;
  expr.type = 'unknown';
  expr.val = null;
  expr.left = null;
  expr.right = null;
};

var N1qlExpr = function(val) {
  _xReset(this, val);
};

var _N1qlLiteral = function(val) {
  if (val instanceof N1qlExpr) {
    return val;
  } else {
    var n = new N1qlExpr(val);
    n.type = 'literal';
    n.val = val;
    return n;
  }
};

var _N1qlConstant = function(val) {
  if (val instanceof N1qlExpr) {
    return val;
  } else {
    var n = new N1qlExpr(val);
    n.type = 'constant';
    n.val = val;
    return n;
  }
};

var _N1qlVariable = function(name) {
  var n = new N1qlExpr();
  n.type = 'variable';
  n.val = name;
  return n;
};

var _xSwap = function(val) {
  var n = new N1qlExpr();
  n.root = val.root;
  n.type = val.type;
  n.val = val.val;
  n.left = val.left;
  n.right = val.right;
  _xReset(val);
  return n;
};

var _xFunc = function(funcName) {
  return function() {
    var n = _xSwap(this);
    this.type = 'function';
    this.val = funcName;
    this.left = [n];
    return this;
  };
};
N1qlExpr.prototype.round = _xFunc('round');

var _xArithmetic = function(operator) {
  return function(val) {
    var n = _xSwap(this);
    this.type = 'arithmetic';
    this.val = operator;
    this.left = n;
    this.right = _N1qlConstant(val);
    return this;
  };
};
N1qlExpr.prototype.add = _xArithmetic('+');
N1qlExpr.prototype.sub = _xArithmetic('-');
N1qlExpr.prototype.div = _xArithmetic('/');
N1qlExpr.prototype.mul = _xArithmetic('*');
N1qlExpr.prototype.mod = _xArithmetic('%');

var _xUArithmetic = function(operator) {
  return function() {
    var n = _xSwap(this);
    this.type = 'arithmetic_unary';
    this.val = operator;
    this.right = n;
    return this;
  };
};
N1qlExpr.prototype.neg = _xUArithmetic('-');

var _xCompare = function(operator) {
  return function(right) {
    var n = _xSwap(this);
    this.type = 'compare';
    this.val = operator;
    this.left = n;
    this.right = _N1qlConstant(right);
    return this;
  };
};
N1qlExpr.prototype.eq = _xCompare('=');
N1qlExpr.prototype.ne = _xCompare('!=');
N1qlExpr.prototype.ltgt = _xCompare('<>');
N1qlExpr.prototype.gt = _xCompare('>');
N1qlExpr.prototype.lt = _xCompare('<');
N1qlExpr.prototype.gte = _xCompare('>=');
N1qlExpr.prototype.lte = _xCompare('<=');
N1qlExpr.prototype.like = _xCompare('like');
N1qlExpr.prototype.notLike = _xCompare('not like');

var _xUCompare = function(operator) {
  return function() {
    var n = _xSwap(this);
    this.type = 'compare_unary';
    this.val = operator;
    this.left = n;
    return this;
  };
};
N1qlExpr.prototype.isMissing = _xUCompare('is missing');
N1qlExpr.prototype.isNotMissing = _xUCompare('is not missing');
N1qlExpr.prototype.isNull = _xUCompare('is null');
N1qlExpr.prototype.isNotNull = _xUCompare('is not null');
N1qlExpr.prototype.isValued = _xUCompare('is valued');
N1qlExpr.prototype.isNotValued = _xUCompare('is not valued');

N1qlExpr.prototype.as = function(name) {
  this.root.alias = name;
  return this;
};

N1qlExpr.prototype.toString = function() {
  var out = '';
  if (this.type === 'constant') {
    if (typeof this.val === 'string') {
      out = '"' + this.val + '"';
    } else {
      out = this.val;
    }
  } else if (this.type === 'literal') {
    out = '`' + this.val + '`';
  } else if (this.type === 'variable') {
    out = ':' + this.val;
  } else if (this.type === 'compare') {
    out = this.left.toString();
    out += this.val.toUpperCase();
    out += this.right.toString();
  } else if (this.type === 'compare_unary') {
    out = this.left.toString();
    out += this.val.toUpperCase();
  } else if (this.type === 'arithmetic') {
    out = this.left.toString();
    out += ' ' + this.val.toUpperCase() + ' ';
    out += this.right.toString();
  } else if (this.type === 'arithmetic_unary') {
    out = this.val.toUpperCase();
    out += this.right.toString();
  } else if (this.type === 'function') {
    out = this.val.toUpperCase();
    out += '(';
    for (var i = 0; i < this.left.length; ++i) {
      if (i !== 0) {
        out += ', ';
      }
      out += this.left[i].toString();
    }
    out += ')';
  }

  if (this.alias) {
    out += ' AS ' + '`' + this.alias + '`';
  }

  return out;
};

N1qlQuery.Literal = _N1qlLiteral;
N1qlQuery.Constant = _N1qlConstant;
N1qlQuery.Variable = _N1qlVariable;
*/
