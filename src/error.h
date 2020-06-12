#pragma once
#ifndef ERROR_H
#define ERROR_H

#include <libcouchbase/couchbase.h>
#include <nan.h>
#include <node.h>

namespace couchnode
{

using namespace v8;

class Error
{
public:
    static NAN_MODULE_INIT(Init);

    static Local<Value> create(const std::string &msg,
                               lcb_STATUS err = LCB_ERR_GENERIC);
    static Local<Value> create(lcb_STATUS err);
};

} // namespace couchnode

#endif // ERROR_H
