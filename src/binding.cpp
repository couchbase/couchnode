#include <nan.h>
#include <node.h>

#include "addondata.h"
#include "cas.h"
#include "connection.h"
#include "constants.h"
#include "error.h"
#include "mutationtoken.h"

namespace couchnode
{

static NAN_MODULE_INIT(init)
{
    addondata::Init(target);
    constants::Init(target);

    Cas::Init(target);
    Connection::Init(target);
    Error::Init(target);
    MutationToken::Init(target);

    Nan::Set(target, Nan::New("lcbVersion").ToLocalChecked(),
             Nan::New<String>(lcb_get_version(NULL)).ToLocalChecked());
}

NAN_MODULE_WORKER_ENABLED(couchbase_impl, couchnode::init)

} // namespace couchnode
