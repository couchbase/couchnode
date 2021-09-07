#pragma once
#ifndef METRICS_H
#define METRICS_H

#include <libcouchbase/couchbase.h>
#include <nan.h>
#include <node.h>

namespace couchnode
{

using namespace v8;

class Meter
{
public:
    Meter(Local<Object> impl);
    ~Meter();

    const lcbmetrics_METER *lcbProcs() const;
    static void destroy(const Meter *meter);

    const lcbmetrics_VALUERECORDER *valueRecorder(const char *name,
                                                  const lcbmetrics_TAG *tags,
                                                  size_t ntags) const;

    void disconnect();

protected:
    bool _enabled;
    lcbmetrics_METER *_lcbMeter;
    Nan::Persistent<Object> _impl;
    Nan::Persistent<Function> _valueRecorderImpl;
};

class ValueRecorder
{
public:
    ValueRecorder(Local<Object> impl);
    ~ValueRecorder();

    const lcbmetrics_VALUERECORDER *lcbProcs() const;
    static void destroy(const ValueRecorder *meter);

    void recordValue(uint64_t value) const;

protected:
    lcbmetrics_VALUERECORDER *_lcbValueRecorder;
    Nan::Persistent<Object> _impl;
    Nan::Persistent<Function> _recordValueImpl;
};

} // namespace couchnode

#endif // METRICS_H
