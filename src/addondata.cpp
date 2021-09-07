#include "addondata.h"
#include "connection.h"

namespace couchnode
{

AddonData::AddonData()
{
}

AddonData::~AddonData()
{
    auto instances = _instances;
    std::for_each(instances.begin(), instances.end(),
                  [](Instance *inst) { delete inst; });
}

void AddonData::add_instance(class Instance *conn)
{
    _instances.push_back(conn);
}

void AddonData::remove_instance(class Instance *conn)
{
    auto connIter = std::find(_instances.begin(), _instances.end(), conn);
    if (connIter != _instances.end()) {
        _instances.erase(connIter);
    }
}

namespace addondata
{

NAN_MODULE_INIT(Init)
{
    auto data = new AddonData();

    auto isolate = v8::Isolate::GetCurrent();
    Nan::SetIsolateData(isolate, data);
    node::AddEnvironmentCleanupHook(isolate, cleanup, isolate);
}

void cleanup(void *p)
{
    v8::Isolate *isolate = static_cast<v8::Isolate *>(p);
    auto data = Nan::GetIsolateData<couchnode::AddonData>(isolate);
    delete data;
}

AddonData *Get()
{
    return Nan::GetIsolateData<AddonData>(
        Nan::GetCurrentContext()->GetIsolate());
}

} // namespace addondata

} // namespace couchnode
