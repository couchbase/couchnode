'use strict'

const { NoOpMeter, NoOpValueRecorder } = require('../../lib/observability')
const { OpAttributeName } = require('../../lib/observabilitytypes')

class NoOpTestValueRecorder extends NoOpValueRecorder {
  constructor(name, attributes) {
    super()
    this.name = name
    this.attributes = attributes
    this.values = []
  }

  recordValue(value) {
    this.values.push(value)
  }
}

// Need to extend NoOpMeter so that the ObservabilityHandler will appropriately choose the NoOp implementation.
// In terms of functionality, since the ObservableRequestHandlerNoOpMeterImpl never calls valueRecorder, all we need
// for testing purposes is verify recorders is always empty.
class NoOpTestMeter extends NoOpMeter {
  constructor() {
    super()
    this.recorders = {}
  }

  valueRecorder(name, attributes) {
    if (!(name in this.recorders)) {
      this.recorders[name] = []
    }
    const recorder = new NoOpTestValueRecorder(name, attributes)
    this.recorders[name].push(recorder)
    return recorder
  }

  clear() {
    this.recorders = {}
  }
}

class TestValueRecorder {
  constructor(name, attributes) {
    this.name = name
    this.opName = undefined
    if (attributes && attributes[OpAttributeName.OperationName]) {
      this.opName = attributes[OpAttributeName.OperationName]
    }
    this.attributes = attributes
    this.values = []
  }

  recordValue(value) {
    this.values.push(value)
  }
}

class TestMeter {
  constructor() {
    this.recorders = new Map()
  }

  valueRecorder(name, attributes) {
    if (!this.recorders.has(name)) {
      this.recorders.set(name, [])
    }
    const recorder = new TestValueRecorder(name, attributes)
    this.recorders.get(name).push(recorder)
    return recorder
  }

  getValueRecorderByOpName(opName) {
    const nameRecorders =
      this.recorders.get(OpAttributeName.MeterNameOpDuration) || []
    return nameRecorders.find((r) => r.opName === opName)
  }

  clear() {
    this.recorders = new Map()
  }
}

module.exports = {
  NoOpTestMeter,
  NoOpTestValueRecorder,
  TestMeter,
  TestValueRecorder,
}
