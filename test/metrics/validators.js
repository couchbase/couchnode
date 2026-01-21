const assert = require('chai').assert

const { NoOpMeter } = require('../../lib/observability')

const {
  DatastructureOp,
  OpAttributeName,
} = require('../../lib/observabilitytypes')

const { NoOpTestMeter, TestMeter } = require('./metertypes')

class BaseValidator {
  constructor(meter, { ctxSeparator = ' | ' } = {}) {
    this._meter = meter
    this._ctxSeparator = ctxSeparator
    this._applyDefaults()
  }

  _defaults() {
    return {
      _opName: null,
      _validateError: false,
      _nestedOps: null,
      _bucketName: null,
      _scopeName: null,
      _collectionName: null,
    }
  }

  _applyDefaults() {
    Object.assign(this, this._defaults())
  }

  reset({ clearRecords = true } = {}) {
    this._applyDefaults()
    if (clearRecords && this._meter && this._meter.clear) {
      this._meter.clear()
    }
    return this
  }

  _ctx(valueRecorder, extra) {
    const parts = []
    if (valueRecorder) {
      parts.push(`name=${valueRecorder.name}`)
      if (valueRecorder.attributes) {
        const attrKeys = Object.keys(valueRecorder.attributes)
        parts.push(`attrs=${attrKeys.join(',')}`)
      }
      if (valueRecorder.opName) {
        parts.push(`opName=${valueRecorder.opName}`)
      }
      if (valueRecorder.values) {
        parts.push(`values=${valueRecorder.values.join(',')}`)
      }
    }
    if (extra) {
      parts.push(extra)
    }
    return parts.join(this._ctxSeparator)
  }

  _getValueRecorderFromMeter(opName, isDataStructureOp = false) {
    const ctx = `op=${opName}`
    assert.isOk(
      this._meter.recorders,
      `meter.records should be defined. ${ctx}`
    )

    assert.strictEqual(
      this._meter.recorders.size,
      1,
      `Expected exactly 1 record. ${ctx}`
    )
    assert.isNotEmpty(
      this._meter.recorders.get(OpAttributeName.MeterNameOpDuration),
      `db.client.operation.duration should not be empty. ${ctx}`
    )
    const valueRecorder = this._meter.getValueRecorderByOpName(opName)

    if (isDataStructureOp) {
      assert.isUndefined(
        valueRecorder,
        `Expected no value recorder for top-level for data structure op. ${ctx}`
      )
      return
    }

    assert.isOk(
      valueRecorder,
      `ValueRecorder not found for op=${opName}. ${ctx}`
    )
    return valueRecorder
  }

  op(value) {
    this._opName = value
    return this
  }

  error(flag = true) {
    this._validateError = flag
    return this
  }

  nestedOps(value) {
    this._nestedOps = value
    return this
  }

  bucketName(value) {
    this._bucketName = value
    return this
  }

  scopeName(value) {
    this._scopeName = value
    return this
  }

  collectionName(value) {
    this._collectionName = value
    return this
  }
}

class BaseValueRecorderValidator extends BaseValidator {
  constructor(meter, collectionDetails, supportsClusterLabels = false) {
    super(meter)
    this._collectionDetails = collectionDetails
    this._supportsClusterLabels = supportsClusterLabels
  }

  _validateBaseMeterProperties(valueRecorder, opName, validateError = false) {
    const ctx = this._ctx(
      valueRecorder,
      `name=${opName},validateError=${validateError}`
    )
    assert.isOk(valueRecorder, `valueRecorder should be defined. ${ctx}`)
    assert.strictEqual(valueRecorder.opName, opName)
    assert.isObject(valueRecorder.attributes)
    assert.strictEqual(
      valueRecorder.attributes[OpAttributeName.SystemName],
      'couchbase'
    )
    assert.strictEqual(
      valueRecorder.attributes[OpAttributeName.ReservedUnit],
      OpAttributeName.ReservedUnitSeconds
    )

    if (this._supportsClusterLabels) {
      assert.isNotEmpty(
        valueRecorder.attributes[OpAttributeName.ClusterName],
        `couchbase.cluster.name should not be empty. ${ctx}`
      )
      assert.isString(
        valueRecorder.attributes[OpAttributeName.ClusterName],
        `couchbase.cluster.name should be a string. ${ctx}`
      )

      assert.isNotEmpty(
        valueRecorder.attributes[OpAttributeName.ClusterUUID],
        `couchbase.cluster.uuid should not be empty. ${ctx}`
      )
      assert.isString(
        valueRecorder.attributes[OpAttributeName.ClusterUUID],
        `couchbase.cluster.uuid should be a string. ${ctx}`
      )
    }

    if (validateError) {
      assert.isNotEmpty(
        valueRecorder.attributes[OpAttributeName.ErrorType],
        `error.type should not be empty. ${ctx}`
      )
      assert.isString(
        valueRecorder.attributes[OpAttributeName.ErrorType],
        `error.type should be a string. ${ctx}`
      )
    }
  }
}

class KeyValueRecorderValidator extends BaseValueRecorderValidator {
  constructor(meter, collectionDetails, supportsClusterLabels = false) {
    super(meter, collectionDetails, supportsClusterLabels)
  }

  _validateMetrics(valueRecorder, opName, validateError) {
    const ctx = this._ctx(
      valueRecorder,
      `op=${opName},validateError=${validateError}`
    )

    this._validateBaseMeterProperties(valueRecorder, opName, validateError)

    assert.strictEqual(
      valueRecorder.attributes[OpAttributeName.OperationName],
      opName,
      `OperationName should match. ${ctx}`
    )
    assert.strictEqual(
      valueRecorder.attributes[OpAttributeName.BucketName],
      this._collectionDetails.bucketName,
      `BucketName should match. ${ctx}`
    )
    assert.strictEqual(
      valueRecorder.attributes[OpAttributeName.ScopeName],
      this._collectionDetails.scopeName,
      `ScopeName should match. ${ctx}`
    )
    assert.strictEqual(
      valueRecorder.attributes[OpAttributeName.CollectionName],
      this._collectionDetails.collName,
      `CollectionName should match. ${ctx}`
    )
  }

  validate() {
    if (Object.values(DatastructureOp).includes(this._opName)) {
      let valueRecorder = this._getValueRecorderFromMeter(this._opName, true)
      for (const nestedOp of this._nestedOps) {
        valueRecorder = this._getValueRecorderFromMeter(nestedOp)
        this._validateMetrics(valueRecorder, nestedOp)
      }
    } else if (this._nestedOps) {
      let valueRecorder = this._getValueRecorderFromMeter(this._opName)
      this._validateMetrics(valueRecorder, this._opName, this._validateError)
      for (const nestedOp of this._nestedOps) {
        valueRecorder = this._getValueRecorderFromMeter(nestedOp)
        this._validateMetrics(valueRecorder, nestedOp, this._validateError)
      }
    } else {
      const valueRecorder = this._getValueRecorderFromMeter(this._opName)
      this._validateMetrics(valueRecorder, this._opName, this._validateError)
    }
  }
}

class NoOpRecorderValidator extends BaseValueRecorderValidator {
  constructor(meter) {
    super(meter)
  }

  validate() {
    assert.isOk(this._meter instanceof NoOpMeter, 'Expected NoOpTracer')
    assert.isEmpty(
      this._meter.recorders,
      'NoOpMeter should not have any recorders'
    )
  }
}

class HttpRecorderValidator extends BaseValueRecorderValidator {
  constructor(meter, supportsClusterLabels = false) {
    super(meter, null, supportsClusterLabels)
  }

  _validateMetrics(valueRecorder, opName, validateError) {
    const ctx = this._ctx(
      valueRecorder,
      `op=${opName},validateError=${validateError}`
    )

    this._validateBaseMeterProperties(valueRecorder, opName, validateError)

    assert.strictEqual(
      valueRecorder.attributes[OpAttributeName.OperationName],
      opName,
      `OperationName should match. ${ctx}`
    )

    if (this._bucketName) {
      assert.strictEqual(
        valueRecorder.attributes[OpAttributeName.BucketName],
        this._bucketName,
        `BucketName should match. ${ctx}`
      )
    }

    if (this._scopeName) {
      assert.strictEqual(
        valueRecorder.attributes[OpAttributeName.ScopeName],
        this._scopeName,
        `ScopeName should match. ${ctx}`
      )
    }

    if (this._collectionName) {
      assert.strictEqual(
        valueRecorder.attributes[OpAttributeName.CollectionName],
        this._collectionName,
        `CollectionName should match. ${ctx}`
      )
    }
  }

  validate() {
    if (this._nestedOps) {
      let valueRecorder = this._getValueRecorderFromMeter(this._opName)
      this._validateMetrics(valueRecorder, this._opName, this._validateError)
      for (const nestedOp of this._nestedOps) {
        valueRecorder = this._getValueRecorderFromMeter(nestedOp)
        this._validateMetrics(valueRecorder, nestedOp, this._validateError)
      }
    } else {
      const valueRecorder = this._getValueRecorderFromMeter(this._opName)
      this._validateMetrics(valueRecorder, this._opName, this._validateError)
    }
  }
}

function createHttpValidator(meter, supportsClusterLabels = false) {
  if (meter instanceof NoOpTestMeter) {
    return new NoOpRecorderValidator(meter)
  } else if (meter instanceof TestMeter) {
    return new HttpRecorderValidator(meter, supportsClusterLabels)
  } else {
    throw new Error('Unsupported meter type for HTTP validator')
  }
}

function createKeyValueValidator(
  meter,
  collectionDetails,
  supportsClusterLabels = false
) {
  if (meter instanceof NoOpTestMeter) {
    return new NoOpRecorderValidator(meter)
  } else if (meter instanceof TestMeter) {
    return new KeyValueRecorderValidator(
      meter,
      collectionDetails,
      supportsClusterLabels
    )
  } else {
    throw new Error('Unsupported meter type for KV validator')
  }
}

module.exports = {
  createHttpValidator,
  createKeyValueValidator,
}
