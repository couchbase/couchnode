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

using namespace std;
using namespace Couchnode;

template <typename T>
class LcbCmd {
public:
  LcbCmd() {
    memset(&cmd, 0, sizeof(cmd));
    cmds[0] = &cmd;
  }

  T * operator->() const {
      return (T*)&cmd;
  }

  operator const T *const *() const {
      return cmds;
  }

  T *cmds[1];
  T cmd;
};

NAN_METHOD(CouchbaseImpl::fnGet) {
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    lcb_CMDGET cmd;
    void *cookie;
    Nan::HandleScope scope;
    CommandEncoder enc;

    memset(&cmd, 0, sizeof(cmd));
    if (!enc.parseKeyBuf(&cmd.key, info[0])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!enc.parseKeyBuf(&cmd._hashkey, info[1])) {
        return Nan::ThrowError(Error::create("bad hashkey passed"));
    }
    if (!enc.parseUintOption(&cmd.exptime, info[2])) {
        return Nan::ThrowError(Error::create("bad expiry passed"));
    }
    if (!enc.parseUintOption(&cmd.lock, info[3])) {
        return Nan::ThrowError(Error::create("bad locked passed"));
    }
    if (!enc.parseCookie(&cookie, info[4])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = lcb_get3(me->getLcbHandle(), cookie, &cmd);
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnGetReplica) {
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    lcb_CMDGETREPLICA cmd;
    void *cookie;
    Nan::HandleScope scope;
    CommandEncoder enc;

    memset(&cmd, 0, sizeof(cmd));
    if (!enc.parseKeyBuf(&cmd.key, info[0])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!enc.parseKeyBuf(&cmd._hashkey, info[1])) {
        return Nan::ThrowError(Error::create("bad hashkey passed"));
    }
    if (info[2]->IsUndefined() || info[2]->IsNull()) {
        cmd.strategy = LCB_REPLICA_FIRST;
    } else {
        cmd.strategy = LCB_REPLICA_SELECT;
        if (!enc.parseUintOption(&cmd.index, info[2])) {
            return Nan::ThrowError(Error::create("bad index passed"));
        }
    }

    if (!enc.parseCookie(&cookie, info[3])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = lcb_rget3(me->getLcbHandle(), cookie, &cmd);
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnTouch) {
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    lcb_CMDTOUCH cmd;
    void *cookie;
    Nan::HandleScope scope;
    CommandEncoder enc;

    memset(&cmd, 0, sizeof(cmd));
    if (!enc.parseKeyBuf(&cmd.key, info[0])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!enc.parseKeyBuf(&cmd._hashkey, info[1])) {
        return Nan::ThrowError(Error::create("bad hashkey passed"));
    }
    if (!enc.parseUintOption(&cmd.exptime, info[2])) {
        return Nan::ThrowError(Error::create("bad expiry passed"));
    }
    if (!enc.parseCookie(&cookie, info[3])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = lcb_touch3(me->getLcbHandle(), cookie, &cmd);
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnUnlock) {
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    lcb_CMDUNLOCK cmd;
    void *cookie;
    Nan::HandleScope scope;
    CommandEncoder enc;

    memset(&cmd, 0, sizeof(cmd));
    if (!enc.parseKeyBuf(&cmd.key, info[0])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!enc.parseKeyBuf(&cmd._hashkey, info[1])) {
        return Nan::ThrowError(Error::create("bad hashkey passed"));
    }
    if (!enc.parseCas(&cmd.cas, info[2])) {
        return Nan::ThrowError(Error::create("bad cas passed"));
    }
    if (!enc.parseCookie(&cookie, info[3])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = lcb_unlock3(me->getLcbHandle(), cookie, &cmd);
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnRemove) {
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    lcb_CMDREMOVE cmd;
    void *cookie;
    Nan::HandleScope scope;
    CommandEncoder enc;

    memset(&cmd, 0, sizeof(cmd));
    if (!enc.parseKeyBuf(&cmd.key, info[0])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!enc.parseKeyBuf(&cmd._hashkey, info[1])) {
        return Nan::ThrowError(Error::create("bad hashkey passed"));
    }
    if (!enc.parseCas(&cmd.cas, info[2])) {
        return Nan::ThrowError(Error::create("bad cas passed"));
    }
    if (!enc.parseCookie(&cookie, info[3])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = lcb_remove3(me->getLcbHandle(), cookie, &cmd);
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnStore) {
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    lcb_CMDSTORE cmd;
    void *cookie;
    Nan::HandleScope scope;
    CommandEncoder enc;

    memset(&cmd, 0, sizeof(cmd));
    cmd.datatype = 0;
    if (!enc.parseKeyBuf(&cmd.key, info[0])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!enc.parseKeyBuf(&cmd._hashkey, info[1])) {
        return Nan::ThrowError(Error::create("bad hashkey passed"));
    }

    cmd.value.vtype = LCB_KV_COPY;
    me->encodeDoc(enc,
            &cmd.value.u_buf.contig.bytes,
            &cmd.value.u_buf.contig.nbytes,
            &cmd.flags,
            info[2]);

    if (!enc.parseUintOption(&cmd.exptime, info[3])) {
        return Nan::ThrowError(Error::create("bad expiry passed"));
    }
    if (!enc.parseCas(&cmd.cas, info[4])) {
        return Nan::ThrowError(Error::create("bad cas passed"));
    }
    if (!enc.parseUintOption(&cmd.operation, info[5])) {
        return Nan::ThrowError(Error::create("bad operation passed"));
    }

    if (!enc.parseCookie(&cookie, info[6])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    if (cmd.operation == LCB_APPEND
          || cmd.operation == LCB_PREPEND) {
        cmd.flags = 0;
    }

    lcb_error_t err = lcb_store3(me->getLcbHandle(), cookie, &cmd);
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnArithmetic) {
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    lcb_CMDCOUNTER cmd;
    void *cookie;
    Nan::HandleScope scope;
    CommandEncoder enc;

    memset(&cmd, 0, sizeof(cmd));
    if (!enc.parseKeyBuf(&cmd.key, info[0])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!enc.parseKeyBuf(&cmd._hashkey, info[1])) {
        return Nan::ThrowError(Error::create("bad hashkey passed"));
    }
    if (!enc.parseUintOption(&cmd.exptime, info[2])) {
        return Nan::ThrowError(Error::create("bad expiry passed"));
    }
    if (!enc.parseIntOption(&cmd.delta, info[3])) {
        return Nan::ThrowError(Error::create("bad delta passed"));
    }
    if (!enc.parseUintOption(&cmd.initial, info[4])) {
        return Nan::ThrowError(Error::create("bad initial passed"));
    }
    if (!info[4]->IsUndefined() && !info[4]->IsNull()) {
        cmd.create = 1;
    }
    if (!enc.parseCookie(&cookie, info[5])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = lcb_counter3(me->getLcbHandle(), cookie, &cmd);
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnDurability) {
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    lcb_CMDENDURE cmd;
    lcb_durability_opts_t opts;
    void *cookie;
    Nan::HandleScope scope;
    CommandEncoder enc;

    memset(&cmd, 0, sizeof(cmd));
    memset(&opts, 0, sizeof(opts));

    if (!enc.parseKeyBuf(&cmd.key, info[0])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!enc.parseKeyBuf(&cmd._hashkey, info[1])) {
        return Nan::ThrowError(Error::create("bad hashkey passed"));
    }
    if (!enc.parseCas(&cmd.cas, info[2])) {
        return Nan::ThrowError(Error::create("bad cas passed"));
    }

    if (!enc.parseUintOption(&opts.v.v0.persist_to, info[3])) {
        return Nan::ThrowError(Error::create("bad persist_to passed"));
    }
    if (!enc.parseUintOption(&opts.v.v0.replicate_to, info[4])) {
        return Nan::ThrowError(Error::create("bad replicate_to passed"));
    }
    if (!enc.parseUintOption(&opts.v.v0.check_delete, info[5])) {
        return Nan::ThrowError(Error::create("bad check_delete passed"));
    }

    if (!enc.parseCookie(&cookie, info[6])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err;
    lcb_MULTICMD_CTX *mctx = lcb_endure3_ctxnew(me->getLcbHandle(), &opts, &err);
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    err = mctx->addcmd(mctx, (const lcb_CMDBASE*)&cmd);
    if (err) {
        mctx->fail(mctx);
        return Nan::ThrowError(Error::create(err));
    }

    err = mctx->done(mctx, cookie);
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnViewQuery) {
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    lcb_CMDVIEWQUERY cmd;
    void *cookie;
    Nan::HandleScope scope;
    CommandEncoder enc;

    memset(&cmd, 0, sizeof(cmd));
    cmd.callback = viewrow_callback;

    if (info[0]->BooleanValue()) {
        cmd.cmdflags |= LCB_CMDVIEWQUERY_F_SPATIAL;
    }

    if (!enc.parseString(&cmd.ddoc, &cmd.nddoc, info[1])) {
        return Nan::ThrowError(Error::create("bad ddoc passed"));
    }
    if (!enc.parseString(&cmd.view, &cmd.nview, info[2])) {
        return Nan::ThrowError(Error::create("bad view passed"));
    }
    if (!enc.parseString(&cmd.optstr, &cmd.noptstr, info[3])) {
        return Nan::ThrowError(Error::create("bad optstr passed"));
    }
    if (!enc.parseString(&cmd.postdata, &cmd.npostdata, info[4])) {
        return Nan::ThrowError(Error::create("bad postdata passed"));
    }
    if (info[5]->BooleanValue()) {
        cmd.cmdflags |= LCB_CMDVIEWQUERY_F_INCLUDE_DOCS;
    }

    if (!enc.parseCookie(&cookie, info[6])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = lcb_view_query(me->getLcbHandle(), cookie, &cmd);
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnN1qlQuery) {
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    lcb_CMDN1QL cmd;
    void *cookie;
    Nan::HandleScope scope;
    CommandEncoder enc;

    Local<Function> jsonStringifyLcl = Nan::New(CouchbaseImpl::jsonStringify);

    memset(&cmd, 0, sizeof(cmd));
    cmd.callback = n1qlrow_callback;
    cmd.content_type = "application/json";

    if (!info[0]->IsUndefined()) {
        if(!enc.parseString(&cmd.host, info[0])) {
            return Nan::ThrowError(Error::create("bad host passed"));
        }
    }

    Handle<Value> optsinfo[] = { info[1] };
    Local<Value> optsVal =
            jsonStringifyLcl->Call(Nan::GetCurrentContext()->Global(), 1, optsinfo);
    Local<String> optsStr = optsVal.As<String>();
    if (!enc.parseString(&cmd.query, &cmd.nquery, optsStr)) {
        return Nan::ThrowError(Error::create("bad opts passed"));
    }

    if (!info[2]->BooleanValue()) {
        cmd.cmdflags |= LCB_CMDN1QL_F_PREPCACHE;
    }

    if (!enc.parseCookie(&cookie, info[3])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = lcb_n1ql_query(me->getLcbHandle(), cookie, &cmd);
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnFtsQuery) {
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    lcb_CMDFTS cmd;
    void *cookie;
    Nan::HandleScope scope;
    CommandEncoder enc;

    Local<Function> jsonStringifyLcl = Nan::New(CouchbaseImpl::jsonStringify);

    memset(&cmd, 0, sizeof(cmd));
    cmd.callback = ftsrow_callback;

    Handle<Value> optsinfo[] = { info[0] };
    Local<Value> optsVal =
            jsonStringifyLcl->Call(Nan::GetCurrentContext()->Global(), 1, optsinfo);
    Local<String> optsStr = optsVal.As<String>();
    if (!enc.parseString(&cmd.query, &cmd.nquery, optsStr)) {
        return Nan::ThrowError(Error::create("bad opts passed"));
    }

    if (!enc.parseCookie(&cookie, info[1])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = lcb_fts_query(me->getLcbHandle(), cookie, &cmd);
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnLookupIn) {
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    lcb_CMDSUBDOC cmd;
    lcb_SDSPEC sdcmd;
    void *cookie;
    lcb_error_t err = LCB_SUCCESS;
    std::vector<lcb_SDSPEC> specs;
    Nan::HandleScope scope;
    CommandEncoder enc;

    memset(&cmd, 0, sizeof(cmd));
    cmd.multimode = LCB_SDMULTI_MODE_LOOKUP;
    if (!enc.parseKeyBuf(&cmd.key, info[0])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!enc.parseKeyBuf(&cmd._hashkey, info[1])) {
        return Nan::ThrowError(Error::create("bad hashkey passed"));
    }
    if (!enc.parseCookie(&cookie, info[info.Length()-1])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    for (int index = 2; index < info.Length() - 1; ++index) {
        memset(&sdcmd, 0, sizeof(sdcmd));

        if (!enc.parseUintOption(&sdcmd.sdcmd, info[index])) {
            return Nan::ThrowError(Error::create("bad optype passed"));
        }

        switch(sdcmd.sdcmd) {
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
        if (!enc.parseKeyBuf(&sdcmd.path, info[index + 1])) {
            return Nan::ThrowError(Error::create("invalid path"));
        }

        // flags
        sdcmd.options |= info[index + 2]->Int32Value();

        specs.push_back(sdcmd);
        index += 2;
    }

    cmd.specs = &specs[0];
    cmd.nspecs = specs.size();

    err = lcb_subdoc3(me->getLcbHandle(), cookie, &cmd);
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnMutateIn) {
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    lcb_CMDSUBDOC cmd;
    lcb_SDSPEC sdcmd;
    void *cookie;
    lcb_error_t err = LCB_SUCCESS;
    std::vector<lcb_SDSPEC> specs;
    Nan::HandleScope scope;
    CommandEncoder enc;

    memset(&cmd, 0, sizeof(cmd));
    cmd.multimode = LCB_SDMULTI_MODE_MUTATE;
    if (!enc.parseKeyBuf(&cmd.key, info[0])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!enc.parseKeyBuf(&cmd._hashkey, info[1])) {
        return Nan::ThrowError(Error::create("bad hashkey passed"));
    }
    if (!enc.parseUintOption(&cmd.exptime, info[2])) {
        return Nan::ThrowError(Error::create("bad expiry passed"));
    }
    if (!enc.parseCas(&cmd.cas, info[3])) {
        return Nan::ThrowError(Error::create("bad cas passed"));
    }
    if (!enc.parseUintOption(&cmd.cmdflags, info[4])) {
        return Nan::ThrowError(Error::create("bad flags passed"));
    }
    if (!enc.parseCookie(&cookie, info[info.Length()-1])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    for (int index = 5; index < info.Length() - 1; ++index) {
        memset(&sdcmd, 0, sizeof(sdcmd));

        if (!enc.parseUintOption(&sdcmd.sdcmd, info[index])) {
            return Nan::ThrowError(Error::create("bad optype passed"));
        }

        int dataCount = 0;
        int isMultiValued = 0;
        switch(sdcmd.sdcmd) {
        case LCB_SDCMD_REMOVE:
            dataCount = 2;
            break;
        case LCB_SDCMD_REPLACE:
        case LCB_SDCMD_DICT_ADD:
        case LCB_SDCMD_DICT_UPSERT:
        case LCB_SDCMD_ARRAY_ADD_UNIQUE:
        case LCB_SDCMD_COUNTER:
            dataCount = 3;
            break;
        case LCB_SDCMD_ARRAY_INSERT:
        case LCB_SDCMD_ARRAY_ADD_FIRST:
        case LCB_SDCMD_ARRAY_ADD_LAST:
            dataCount = 3;
            isMultiValued = 1;
            break;
        default:
            return Nan::ThrowError(Error::create("unexpected optype"));
        }

        if (index + dataCount >= info.Length()) {
            return Nan::ThrowError(Error::create("missing params"));
        }

        // path
        if (dataCount >= 1) {
            if (!enc.parseKeyBuf(&sdcmd.path, info[index + 1])) {
                return Nan::ThrowError(Error::create("invalid path"));
            }
        }

        // flags
        if (dataCount >= 2) {
            sdcmd.options |= info[index + 2]->Int32Value();
        }

        // value/delta
        if (dataCount >= 3) {
            // I don't believe this can actually fail, no need to test
            sdcmd.value.vtype = LCB_KV_COPY;
            DefaultTranscoder::encodeJson(enc,
                    &sdcmd.value.u_buf.contig.bytes,
                    &sdcmd.value.u_buf.contig.nbytes,
                    info[index + 3]);

           if (isMultiValued != 0) {
              // Strip the brackets off of this.
              *((char*)&sdcmd.value.u_buf.contig.bytes) += 1;
              sdcmd.value.u_buf.contig.nbytes -= 2;
           }
        }

        specs.push_back(sdcmd);
        index += dataCount;
    }

    cmd.specs = &specs[0];
    cmd.nspecs = specs.size();

    err = lcb_subdoc3(me->getLcbHandle(), cookie, &cmd);
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnPing) {
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    lcb_CMDPING cmd;
    void *cookie;
    Nan::HandleScope scope;
    CommandEncoder enc;

    memset(&cmd, 0, sizeof(cmd));
    cmd.options = LCB_PINGOPT_F_JSON | LCB_PINGOPT_F_JSONDETAILS;
    if (!enc.parseUintOption(&cmd.services, info[0])) {
        return Nan::ThrowError(Error::create("bad services passed"));
    }
    if (!enc.parseCookie(&cookie, info[1])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = lcb_ping3(me->getLcbHandle(), cookie, &cmd);
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnDiag) {
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    lcb_CMDDIAG cmd;
    void *cookie;
    Nan::HandleScope scope;
    CommandEncoder enc;

    memset(&cmd, 0, sizeof(cmd));
    if (!enc.parseCookie(&cookie, info[0])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = lcb_diag(me->getLcbHandle(), cookie, &cmd);
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}
