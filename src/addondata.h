#pragma once
#ifndef ADDONDATA_H
#define ADDONDATA_H

#include <list>
#include <nan.h>
#include <node.h>

namespace couchnode
{

using namespace v8;

class AddonData
{
public:
    AddonData();
    ~AddonData();

    void add_instance(class Instance *conn);
    void remove_instance(class Instance *conn);

    std::list<class Instance *> _instances;
    Nan::Persistent<Function> _connectionConstructor;
    Nan::Persistent<Function> _casConstructor;
    Nan::Persistent<Function> _mutationtokenConstructor;
};

namespace addondata
{

NAN_MODULE_INIT(Init);
void cleanup(void *p);
AddonData *Get();

} // namespace addondata

} // namespace couchnode

#endif // ADDONDATA_H
