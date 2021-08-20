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
    ~AddonData();
    void add_connection(class Connection *conn);
    void remove_connection(class Connection *conn);

    std::list<class Connection *> connections;

    Nan::Persistent<Function> connection_constructor;
    Nan::Persistent<Function> cas_constructor;
    Nan::Persistent<Function> mutationtoken_constructor;
};

namespace addondata
{

NAN_MODULE_INIT(Init);
void cleanup(void *p);
AddonData *Get();

} // namespace addondata

} // namespace couchnode

#endif // ADDONDATA_H
