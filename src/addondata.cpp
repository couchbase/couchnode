#include "addondata.h"
#include "connection.h"

namespace couchnode
{

AddonData::~AddonData()
{
    std::for_each(connections.begin(), connections.end(),
                  [](Connection *conn) { conn->shutdown(false); });
}

void AddonData::add_connection(class Connection *conn)
{
    connections.push_back(conn);
}

void AddonData::remove_connection(class Connection *conn)
{
    auto connIter = std::find(connections.begin(), connections.end(), conn);
    if (connIter != connections.end()) {
        connections.erase(connIter);
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
