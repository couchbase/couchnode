#include "metrics.h"

namespace couchnode
{

Meter *unwrapMeter(const lcbmetrics_METER *procs)
{
    Meter *meter = nullptr;
    if (lcbmetrics_meter_cookie(procs, (void **)(&meter)) != LCB_SUCCESS) {
        meter = nullptr;
    }
    return meter;
}

ValueRecorder *unwrapValueRecorder(const lcbmetrics_VALUERECORDER *procs)
{
    ValueRecorder *recorder = nullptr;
    if (lcbmetrics_valuerecorder_cookie(procs, (void **)(&recorder)) !=
        LCB_SUCCESS) {
        recorder = nullptr;
    }
    return recorder;
}

void lcbMeterDtor(const lcbmetrics_METER *procs)
{
    const Meter *meter = unwrapMeter(procs);
    if (meter) {
        Meter::destroy(meter);
    }
}

static const lcbmetrics_VALUERECORDER *
lcbMeterValueRecorder(const lcbmetrics_METER *procs, const char *name,
                      const lcbmetrics_TAG *tags, size_t ntags)
{
    const Meter *meter = unwrapMeter(procs);
    if (meter) {
        return meter->valueRecorder(name, tags, ntags);
    }
    return nullptr;
}

void lcbValueRecorderDtor(const lcbmetrics_VALUERECORDER *procs)
{
    const ValueRecorder *recorder = unwrapValueRecorder(procs);
    if (recorder) {
        ValueRecorder::destroy(recorder);
    }
}

void lcbValueRecorderRecordValue(const lcbmetrics_VALUERECORDER *procs,
                                 uint64_t value)
{
    const ValueRecorder *recorder = unwrapValueRecorder(procs);
    if (recorder) {
        recorder->recordValue(value);
    }
}

Meter::Meter(Local<Object> impl)
    : _enabled(true)
{
    lcbmetrics_meter_create(&_lcbMeter, this);
    lcbmetrics_meter_dtor_callback(_lcbMeter, &lcbMeterDtor);
    lcbmetrics_meter_value_recorder_callback(_lcbMeter, &lcbMeterValueRecorder);

    _impl.Reset(impl);
    _valueRecorderImpl.Reset(
        Nan::Get(impl, Nan::New("valueRecorder").ToLocalChecked())
            .ToLocalChecked()
            .As<Function>());
}

Meter::~Meter()
{
    _impl.Reset();
    _valueRecorderImpl.Reset();
    lcbmetrics_meter_destroy(_lcbMeter);
    _lcbMeter = nullptr;
}

const lcbmetrics_METER *Meter::lcbProcs() const
{
    return _lcbMeter;
}

void Meter::disconnect()
{
    _enabled = false;
}

void Meter::destroy(const Meter *meter)
{
    delete meter;
}

const lcbmetrics_VALUERECORDER *Meter::valueRecorder(const char *name,
                                                     const lcbmetrics_TAG *tags,
                                                     size_t ntags) const
{
    if (!_enabled) {
        return nullptr;
    }

    // We don't perform any cacheing to avoid calls into v8 here as libcouchbase
    // already contractually provides cacheing to reduce the calls to this
    // method.

    Nan::HandleScope scope;
    Local<Object> impl = Nan::New(_impl);
    Local<Function> valueRecorderImpl = Nan::New(_valueRecorderImpl);
    if (impl.IsEmpty() || valueRecorderImpl.IsEmpty()) {
        return nullptr;
    }

    Local<String> nameVal = Nan::New<String>(name).ToLocalChecked();
    Local<Array> tagsVal = Nan::New<Array>();
    for (size_t i = 0; i < ntags; ++i) {
        Nan::Set(tagsVal, Nan::New(tags[i].key).ToLocalChecked(),
                 Nan::New(tags[i].value).ToLocalChecked());
    }
    Local<Value> argv[] = {nameVal, tagsVal};
    Local<Value> res =
        Nan::Call(valueRecorderImpl, impl, 2, argv).ToLocalChecked();
    if (res.IsEmpty() || !res->IsObject()) {
        return nullptr;
    }

    return (new ValueRecorder(res.As<Object>()))->lcbProcs();
}

ValueRecorder::ValueRecorder(Local<Object> impl)
{
    lcbmetrics_valuerecorder_create(&_lcbValueRecorder, this);
    lcbmetrics_valuerecorder_dtor_callback(_lcbValueRecorder,
                                           &lcbValueRecorderDtor);
    lcbmetrics_valuerecorder_record_value_callback(
        _lcbValueRecorder, &lcbValueRecorderRecordValue);

    _impl.Reset(impl);
    _recordValueImpl.Reset(
        Nan::Get(impl, Nan::New("recordValue").ToLocalChecked())
            .ToLocalChecked()
            .As<Function>());
}

ValueRecorder::~ValueRecorder()
{
    _impl.Reset();
    _recordValueImpl.Reset();
    lcbmetrics_valuerecorder_destroy(_lcbValueRecorder);
    _lcbValueRecorder = nullptr;
}

const lcbmetrics_VALUERECORDER *ValueRecorder::lcbProcs() const
{
    return _lcbValueRecorder;
}

void ValueRecorder::destroy(const ValueRecorder *recorder)
{
    delete recorder;
}

void ValueRecorder::recordValue(uint64_t value) const
{
    Nan::HandleScope scope;
    Local<Object> impl = Nan::New(_impl);
    Local<Function> recordValueImpl = Nan::New(_recordValueImpl);
    if (impl.IsEmpty() || recordValueImpl.IsEmpty()) {
        return;
    }

    Local<Number> valueVal = Nan::New<Number>(value);
    Local<Value> argv[] = {valueVal};
    Nan::Call(recordValueImpl, impl, 1, argv);
}

} // namespace couchnode
