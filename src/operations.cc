/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2012 Couchbase, Inc.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

#include "couchbase_impl.h"
#include "exception.h"
#include "opbuilder.h"

using namespace std;
using namespace Couchnode;

NAN_METHOD(CouchbaseImpl::fnGet)
{
    Nan::HandleScope scope;
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    OpBuilder<lcb_CMDGET> enc(me);

    enc.beginTrace("get");

    if (!enc.parseOption<&lcb_CMDGET::key>(info[0])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!enc.parseOption<&lcb_CMDGET::_hashkey>(info[1])) {
        return Nan::ThrowError(Error::create("bad hashkey passed"));
    }
    if (!enc.parseOption<&lcb_CMDGET::exptime>(info[2])) {
        return Nan::ThrowError(Error::create("bad expiry passed"));
    }
    if (!enc.parseOption<&lcb_CMDGET::lock>(info[3])) {
        return Nan::ThrowError(Error::create("bad locked passed"));
    }
    if (!enc.parseCallback(info[4])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = enc.execute<&lcb_get3>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnGetReplica)
{
    Nan::HandleScope scope;
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    OpBuilder<lcb_CMDGETREPLICA> enc(me);

    enc.beginTrace("getReplica");

    if (!enc.parseOption<&lcb_CMDGETREPLICA::key>(info[0])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!enc.parseOption<&lcb_CMDGETREPLICA::_hashkey>(info[1])) {
        return Nan::ThrowError(Error::create("bad hashkey passed"));
    }
    if (info[2]->IsUndefined() || info[2]->IsNull()) {
        enc.cmd()->strategy = LCB_REPLICA_FIRST;
    } else {
        enc.cmd()->strategy = LCB_REPLICA_SELECT;
        if (!enc.parseOption<&lcb_CMDGETREPLICA::index>(info[2])) {
            return Nan::ThrowError(Error::create("bad index passed"));
        }
    }
    if (!enc.parseCallback(info[3])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = enc.execute<&lcb_rget3>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnTouch)
{
    Nan::HandleScope scope;
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    OpBuilder<lcb_CMDTOUCH> enc(me);

    enc.beginTrace("touch");

    if (!enc.parseOption<&lcb_CMDTOUCH::key>(info[0])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!enc.parseOption<&lcb_CMDTOUCH::_hashkey>(info[1])) {
        return Nan::ThrowError(Error::create("bad hashkey passed"));
    }
    if (!enc.parseOption<&lcb_CMDTOUCH::exptime>(info[2])) {
        return Nan::ThrowError(Error::create("bad expiry passed"));
    }
    if (!enc.parseCallback(info[3])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = enc.execute<&lcb_touch3>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnUnlock)
{
    Nan::HandleScope scope;
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    OpBuilder<lcb_CMDUNLOCK> enc(me);

    enc.beginTrace("unlock");

    if (!enc.parseOption<&lcb_CMDUNLOCK::key>(info[0])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!enc.parseOption<&lcb_CMDUNLOCK::_hashkey>(info[1])) {
        return Nan::ThrowError(Error::create("bad hashkey passed"));
    }
    if (!enc.parseOption<&lcb_CMDUNLOCK::cas>(info[2])) {
        return Nan::ThrowError(Error::create("bad expiry passed"));
    }
    if (!enc.parseCallback(info[3])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = enc.execute<&lcb_unlock3>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnRemove)
{
    Nan::HandleScope scope;
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    OpBuilder<lcb_CMDREMOVE> enc(me);

    enc.beginTrace("remove");

    if (!enc.parseOption<&lcb_CMDREMOVE::key>(info[0])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!enc.parseOption<&lcb_CMDREMOVE::_hashkey>(info[1])) {
        return Nan::ThrowError(Error::create("bad hashkey passed"));
    }
    if (!enc.parseOption<&lcb_CMDREMOVE::cas>(info[2])) {
        return Nan::ThrowError(Error::create("bad expiry passed"));
    }
    if (!enc.parseCallback(info[3])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = enc.execute<&lcb_remove3>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnStore)
{
    Nan::HandleScope scope;
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    OpBuilder<lcb_CMDSTORE> enc(me);

    const char *opName = "store";
    lcb_U32 opType = ValueParser::asUint(info[5]);
    switch (opType) {
    case LCB_SET:
        opName = "upsert";
        break;
    case LCB_ADD:
        opName = "insert";
        break;
    case LCB_REPLACE:
        opName = "replace";
        break;
    case LCB_APPEND:
        opName = "append";
        break;
    case LCB_PREPEND:
        opName = "prepend";
        break;
    }
    enc.beginTrace(opName);

    if (!enc.parseOption<&lcb_CMDSTORE::key>(info[0])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!enc.parseOption<&lcb_CMDSTORE::_hashkey>(info[1])) {
        return Nan::ThrowError(Error::create("bad hashkey passed"));
    }
    if (!enc.parseValue(info[2])) {
        return Nan::ThrowError(Error::create("bad doc passed"));
    }
    if (!enc.parseOption<&lcb_CMDSTORE::exptime>(info[3])) {
        return Nan::ThrowError(Error::create("bad expiry passed"));
    }
    if (!enc.parseOption<&lcb_CMDSTORE::cas>(info[4])) {
        return Nan::ThrowError(Error::create("bad cas passed"));
    }
    if (!enc.parseOption<&lcb_CMDSTORE::operation>(info[5])) {
        return Nan::ThrowError(Error::create("bad operation passed"));
    }
    if (!enc.parseCallback(info[6])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    // In the case of APPEND/PREPEND, we need to clear the flags bits
    // to avoid any confusion about what is being set.
    switch (enc.cmd()->operation) {
    case LCB_APPEND:
    case LCB_PREPEND:
        enc.cmd()->flags = 0;
        break;
    default:
        break;
        // No need to do anything special for everyone else
    }

    lcb_error_t err = enc.execute<&lcb_store3>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnArithmetic)
{
    Nan::HandleScope scope;
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    OpBuilder<lcb_CMDCOUNTER> enc(me);

    enc.beginTrace("arithmetic");

    if (!enc.parseOption<&lcb_CMDCOUNTER::key>(info[0])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!enc.parseOption<&lcb_CMDCOUNTER::_hashkey>(info[1])) {
        return Nan::ThrowError(Error::create("bad hashkey passed"));
    }
    if (!enc.parseOption<&lcb_CMDCOUNTER::exptime>(info[2])) {
        return Nan::ThrowError(Error::create("bad expiry passed"));
    }
    if (!enc.parseOption<&lcb_CMDCOUNTER::delta>(info[3])) {
        return Nan::ThrowError(Error::create("bad delta passed"));
    }
    if (!enc.parseOption<&lcb_CMDCOUNTER::initial>(info[4])) {
        return Nan::ThrowError(Error::create("bad initial passed"));
    }
    if (!info[4]->IsUndefined() && !info[4]->IsNull() && !info[4]->IsFalse()) {
        enc.cmd()->create = 1;
    }
    if (!enc.parseCallback(info[5])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = enc.execute<&lcb_counter3>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnDurability)
{
    Nan::HandleScope scope;
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    MultiCmdOpBuilder<lcb_DURABILITYOPTSv0, lcb_CMDENDURE> enc(me);
    CmdBuilder<lcb_CMDENDURE> cmdEnc = enc.makeSubCmdBuilder<lcb_CMDENDURE>();

    enc.beginTrace("durability");

    if (!cmdEnc.parseOption<&lcb_CMDENDURE::key>(info[0])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!cmdEnc.parseOption<&lcb_CMDENDURE::_hashkey>(info[1])) {
        return Nan::ThrowError(Error::create("bad hashkey passed"));
    }
    if (!cmdEnc.parseOption<&lcb_CMDENDURE::cas>(info[2])) {
        return Nan::ThrowError(Error::create("bad cas passed"));
    }
    if (!enc.parseOption<&lcb_DURABILITYOPTSv0::persist_to>(info[3])) {
        return Nan::ThrowError(Error::create("bad persist_to passed"));
    }
    if (!enc.parseOption<&lcb_DURABILITYOPTSv0::replicate_to>(info[4])) {
        return Nan::ThrowError(Error::create("bad replicate_to passed"));
    }
    if (!enc.parseOption<&lcb_DURABILITYOPTSv0::check_delete>(info[5])) {
        return Nan::ThrowError(Error::create("bad check_delete passed"));
    }
    if (!enc.parseCallback(info[6])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    enc.addSubCmd(cmdEnc);

    lcb_error_t err = enc.execute<&lcb_endure3_ctxnew>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnViewQuery)
{
    Nan::HandleScope scope;
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    HandleOpBuilder<lcb_CMDVIEWQUERY, lcb_VIEWHANDLE> enc(me);

    enc.beginTrace("query::view");

    enc.cmd()->callback = viewrow_callback;

    if (info[0]->BooleanValue()) {
        enc.cmd()->cmdflags |= LCB_CMDVIEWQUERY_F_SPATIAL;
    }
    if (!enc.parseStrOption<&lcb_CMDVIEWQUERY::ddoc>(info[1])) {
        return Nan::ThrowError(Error::create("bad ddoc passed"));
    }
    if (!enc.parseStrOption<&lcb_CMDVIEWQUERY::view>(info[2])) {
        return Nan::ThrowError(Error::create("bad view passed"));
    }
    if (!enc.parseStrOption<&lcb_CMDVIEWQUERY::optstr>(info[3])) {
        return Nan::ThrowError(Error::create("bad optstr passed"));
    }
    if (!enc.parseStrOption<&lcb_CMDVIEWQUERY::postdata>(info[4])) {
        return Nan::ThrowError(Error::create("bad postdata passed"));
    }
    if (info[5]->BooleanValue()) {
        enc.cmd()->cmdflags |= LCB_CMDVIEWQUERY_F_INCLUDE_DOCS;
    }
    if (!enc.parseCallback(info[6])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = enc.execute<&lcb_view_query>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnN1qlQuery)
{
    Nan::HandleScope scope;
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    HandleOpBuilder<lcb_CMDN1QL, lcb_N1QLHANDLE> enc(me);

    enc.beginTrace("query::n1ql");

    enc.cmd()->callback = n1qlrow_callback;
    enc.cmd()->content_type = "application/json";

    if (!info[0]->IsUndefined()) {
        if (!enc.parseStrOption<&lcb_CMDN1QL::host>(info[0])) {
            return Nan::ThrowError(Error::create("bad host passed"));
        }
    }
    if (!enc.parseStrOption<&lcb_CMDN1QL::query>(info[1])) {
        return Nan::ThrowError(Error::create("bad opts passed"));
    }
    if (!info[2]->BooleanValue()) {
        enc.cmd()->cmdflags |= LCB_CMDN1QL_F_PREPCACHE;
    }
    if (!enc.parseCallback(info[3])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = enc.execute<&lcb_n1ql_query>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnCbasQuery)
{
    Nan::HandleScope scope;
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    HandleOpBuilder<lcb_CMDN1QL, lcb_N1QLHANDLE> enc(me);

    enc.beginTrace("query::cbas");

    enc.cmd()->callback = cbasrow_callback;
    enc.cmd()->content_type = "application/json";
    enc.cmd()->cmdflags = LCB_CMDN1QL_F_CBASQUERY;

    if (!info[0]->IsUndefined()) {
        if (!enc.parseStrOption<&lcb_CMDN1QL::host>(info[0])) {
            return Nan::ThrowError(Error::create("bad host passed"));
        }
    }
    if (!enc.parseStrOption<&lcb_CMDN1QL::query>(info[1])) {
        return Nan::ThrowError(Error::create("bad opts passed"));
    }
    if (!enc.parseCallback(info[2])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = enc.execute<&lcb_n1ql_query>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnFtsQuery)
{
    Nan::HandleScope scope;
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    HandleOpBuilder<lcb_CMDFTS, lcb_FTSHANDLE> enc(me);

    enc.beginTrace("query::fts");

    enc.cmd()->callback = ftsrow_callback;

    if (!enc.parseStrOption<&lcb_CMDFTS::query>(info[0])) {
        return Nan::ThrowError(Error::create("bad query passed"));
    }
    if (!enc.parseCallback(info[1])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = enc.execute<&lcb_fts_query>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnLookupIn)
{
    Nan::HandleScope scope;
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    OpBuilder<lcb_CMDSUBDOC> enc(me);
    std::vector<lcb_SDSPEC> specs;

    enc.beginTrace("lookupIn");

    enc.cmd()->multimode = LCB_SDMULTI_MODE_LOOKUP;

    if (!enc.parseOption<&lcb_CMDSUBDOC::key>(info[0])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!enc.parseOption<&lcb_CMDSUBDOC::_hashkey>(info[1])) {
        return Nan::ThrowError(Error::create("bad hashkey passed"));
    }
    if (!enc.parseCallback(info[info.Length() - 1])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    for (int index = 2; index < info.Length() - 1; ++index) {
        CmdBuilder<lcb_SDSPEC> cmdEnc = enc.makeSubCmdBuilder<lcb_SDSPEC>();

        if (!cmdEnc.parseOption<&lcb_SDSPEC::sdcmd>(info[index])) {
            return Nan::ThrowError(Error::create("bad optype passed"));
        }

        switch (cmdEnc.cmd()->sdcmd) {
        case LCB_SDCMD_GET:
        case LCB_SDCMD_GET_COUNT:
        case LCB_SDCMD_EXISTS:
            break;
        default:
            return Nan::ThrowError(Error::create("unexpected optype"));
        }

        if (index + 2 >= info.Length()) {
            return Nan::ThrowError(Error::create("missing params"));
        }

        // path
        if (!cmdEnc.parseOption<&lcb_SDSPEC::path>(info[index + 1])) {
            return Nan::ThrowError(Error::create("invalid path"));
        }

        // flags
        if (!cmdEnc.parseOption<&lcb_SDSPEC::options>(info[index + 2])) {
            return Nan::ThrowError(Error::create("invalid flags"));
        }

        specs.push_back(*cmdEnc.cmd());
        index += 2;
    }

    enc.cmd()->specs = specs.data();
    enc.cmd()->nspecs = specs.size();

    lcb_error_t err = enc.execute<&lcb_subdoc3>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnMutateIn)
{
    Nan::HandleScope scope;
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    OpBuilder<lcb_CMDSUBDOC> enc(me);
    std::vector<lcb_SDSPEC> specs;

    enc.beginTrace("mutateIn");

    enc.cmd()->multimode = LCB_SDMULTI_MODE_MUTATE;

    if (!enc.parseOption<&lcb_CMDSUBDOC::key>(info[0])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!enc.parseOption<&lcb_CMDSUBDOC::_hashkey>(info[1])) {
        return Nan::ThrowError(Error::create("bad hashkey passed"));
    }
    if (!enc.parseOption<&lcb_CMDSUBDOC::exptime>(info[2])) {
        return Nan::ThrowError(Error::create("bad expiry passed"));
    }
    if (!enc.parseOption<&lcb_CMDSUBDOC::cas>(info[3])) {
        return Nan::ThrowError(Error::create("bad cas passed"));
    }
    if (!enc.parseOption<&lcb_CMDSUBDOC::cmdflags>(info[4])) {
        return Nan::ThrowError(Error::create("bad flags passed"));
    }
    if (!enc.parseCallback(info[info.Length() - 1])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    for (int index = 5; index < info.Length() - 1; ++index) {
        CmdBuilder<lcb_SDSPEC> cmdEnc = enc.makeSubCmdBuilder<lcb_SDSPEC>();

        if (!cmdEnc.parseOption<&lcb_SDSPEC::sdcmd>(info[index])) {
            return Nan::ThrowError(Error::create("bad optype passed"));
        }

        int dataCount = 0;
        switch (cmdEnc.cmd()->sdcmd) {
        case LCB_SDCMD_REMOVE:
            dataCount = 2;
            break;
        case LCB_SDCMD_REPLACE:
        case LCB_SDCMD_DICT_ADD:
        case LCB_SDCMD_DICT_UPSERT:
        case LCB_SDCMD_ARRAY_ADD_UNIQUE:
        case LCB_SDCMD_COUNTER:
        case LCB_SDCMD_ARRAY_INSERT:
        case LCB_SDCMD_ARRAY_ADD_FIRST:
        case LCB_SDCMD_ARRAY_ADD_LAST:
            dataCount = 3;
            break;
        default:
            return Nan::ThrowError(Error::create("unexpected optype"));
        }

        if (index + dataCount >= info.Length()) {
            return Nan::ThrowError(Error::create("missing params"));
        }

        // path
        if (dataCount >= 1) {
            if (!cmdEnc.parseOption<&lcb_SDSPEC::path>(info[index + 1])) {
                return Nan::ThrowError(Error::create("invalid path"));
            }
        }

        // flags
        if (dataCount >= 2) {
            if (!cmdEnc.parseOption<&lcb_SDSPEC::options>(info[index + 2])) {
                return Nan::ThrowError(Error::create("invalid flags"));
            }
        }

        // value/delta
        if (dataCount >= 3) {
            if (!cmdEnc.parseOption<&lcb_SDSPEC::value>(info[index + 3])) {
                return Nan::ThrowError(Error::create("invalid data"));
            }
        }

        specs.push_back(*cmdEnc.cmd());
        index += dataCount;
    }

    enc.cmd()->specs = specs.data();
    enc.cmd()->nspecs = specs.size();

    lcb_error_t err = enc.execute<&lcb_subdoc3>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnPing)
{
    Nan::HandleScope scope;
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    OpBuilder<lcb_CMDPING> enc(me);

    enc.beginTrace("ping");

    enc.cmd()->options = LCB_PINGOPT_F_JSON | LCB_PINGOPT_F_JSONDETAILS;

    if (!enc.parseOption<&lcb_CMDPING::services>(info[0])) {
        return Nan::ThrowError(Error::create("bad services passed"));
    }
    if (!enc.parseCallback(info[1])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = enc.execute<&lcb_ping3>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnDiag)
{
    Nan::HandleScope scope;
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    OpBuilder<lcb_CMDDIAG> enc(me);

    enc.beginTrace("diag");

    if (!enc.parseCallback(info[0])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = enc.execute<&lcb_diag>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnHttpRequest)
{
    Nan::HandleScope scope;
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    OpBuilder<lcb_CMDHTTP> enc(me);

    enc.beginTrace("http::generic");

    enc.cmd()->cmdflags = LCB_CMDHTTP_F_STREAM;

    if (!enc.parseOption<&lcb_CMDHTTP::type>(info[0])) {
        return Nan::ThrowError(Error::create("bad type passed"));
    }
    if (!enc.parseOption<&lcb_CMDHTTP::method>(info[1])) {
        return Nan::ThrowError(Error::create("bad method passed"));
    }
    if (!enc.parseStrOption<&lcb_CMDHTTP::username>(info[2])) {
        return Nan::ThrowError(Error::create("bad username passed"));
    }
    if (!enc.parseStrOption<&lcb_CMDHTTP::password>(info[3])) {
        return Nan::ThrowError(Error::create("bad password passed"));
    }
    if (!enc.parseOption<&lcb_CMDHTTP::key>(info[4])) {
        return Nan::ThrowError(Error::create("bad path passed"));
    }
    if (!enc.parseStrOption<&lcb_CMDHTTP::content_type>(info[5])) {
        return Nan::ThrowError(Error::create("bad content type passed"));
    }
    if (!enc.parseStrOption<&lcb_CMDHTTP::body>(info[6])) {
        return Nan::ThrowError(Error::create("bad body passed"));
    }
    if (!enc.parseCallback(info[7])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = enc.execute<&lcb_http3>();
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}
