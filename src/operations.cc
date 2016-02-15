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

using namespace std;
using namespace Couchnode;

bool _ParseCookie(void ** cookie, Local<Value> callback) {
  if (callback->IsFunction()) {
    *cookie = new Nan::Callback(callback.As<v8::Function>());
    return true;
  }
  return false;
}

static const int PS_KEY = 0;
static const int PS_HASHKEY = 1;
static const int PS_DDOC = 2;
static const int PS_VIEW = 3;
static const int PS_OPTSTR = 4;
static const int PS_HOST = 5;
static const int PS_QUERY = 6;
template <int X, size_t Y, typename T, typename V>
bool _ParseString(const T** val, V* nval, Local<Value> key) {
    static Nan::Utf8String *utfKey = NULL;
    if (utfKey) {
        delete utfKey;
    }
    utfKey = new Nan::Utf8String(key);
    if (nval) {
        *nval = utfKey->length();
    }
    *val = **utfKey;
    return true;
}
template <int X, typename T, typename V>
bool _ParseString(const T** val, V* nval, Local<Value> key) {
    return _ParseString<X, 256>(val, nval, key);
}


template <typename T>
bool _ParseKey(T* cmdV, Local<Value> key) {
  return _ParseString<PS_KEY>(&cmdV->key, &cmdV->nkey, key);
}

template <typename T>
bool _ParseHashkey(T* cmdV, Local<Value> hashkey) {
  if (!hashkey->IsUndefined() && !hashkey->IsNull()) {
      _ParseString<PS_HASHKEY>(&cmdV->hashkey, &cmdV->nhashkey, hashkey);
  }
  return true;
}

template <typename T>
bool _ParseCas(T* cmdV, Local<Value> cas) {
    if (!cas->IsUndefined() && !cas->IsNull()) {
        return Cas::GetCas(cas, &cmdV->cas);
    }
    return true;
}

template<typename T>
bool _ParseUintOption(T *out, Local<Value> value) {
  if (value.IsEmpty()) {
    return true;
  }

  Local<Uint32> valueTyped = value->ToUint32();
  if (valueTyped.IsEmpty()) {
    return false;
  }

  *out = (T)valueTyped->Value();
  return true;
}

template<typename T>
bool _ParseIntOption(T *out, Local<Value> value) {
  if (value.IsEmpty()) {
    return true;
  }

  Local<Integer> valueTyped = value->ToInteger();
  if (valueTyped.IsEmpty()) {
    return false;
  }

  *out = valueTyped->Value();
  return true;
}

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
    LcbCmd<lcb_get_cmd_st> cmd;
    void *cookie;
    Nan::HandleScope scope;

    cmd->version = 0;
    if (!_ParseKey(&cmd->v.v0, info[0])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!_ParseHashkey(&cmd->v.v0, info[1])) {
        return Nan::ThrowError(Error::create("bad hashkey passed"));
    }
    if (!_ParseUintOption(&cmd->v.v0.exptime, info[2])) {
        return Nan::ThrowError(Error::create("bad expiry passed"));
    }
    if (!_ParseUintOption(&cmd->v.v0.lock, info[3])) {
        return Nan::ThrowError(Error::create("bad locked passed"));
    }
    if (!_ParseCookie(&cookie, info[4])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = lcb_get(me->getLcbHandle(), cookie, 1, cmd);
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnGetReplica) {
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    LcbCmd<lcb_get_replica_cmd_t> cmd;
    void *cookie;
    Nan::HandleScope scope;

    cmd->version = 1;
    if (!_ParseKey(&cmd->v.v0, info[0])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!_ParseHashkey(&cmd->v.v0, info[1])) {
        return Nan::ThrowError(Error::create("bad hashkey passed"));
    }
    if (info[2]->IsUndefined() || info[2]->IsNull()) {
        cmd->v.v1.strategy = LCB_REPLICA_FIRST;
    } else {
        cmd->v.v1.strategy = LCB_REPLICA_SELECT;
        if (!_ParseUintOption(&cmd->v.v1.index, info[2])) {
            return Nan::ThrowError(Error::create("bad index passed"));
        }
    }

    if (!_ParseCookie(&cookie, info[3])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = lcb_get_replica(me->getLcbHandle(), cookie, 1, cmd);
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnTouch) {
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    LcbCmd<lcb_get_cmd_st> cmd;
    void *cookie;
    Nan::HandleScope scope;

    cmd->version = 0;
    if (!_ParseKey(&cmd->v.v0, info[0])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!_ParseHashkey(&cmd->v.v0, info[1])) {
        return Nan::ThrowError(Error::create("bad hashkey passed"));
    }
    if (!_ParseUintOption(&cmd->v.v0.exptime, info[2])) {
        return Nan::ThrowError(Error::create("bad expiry passed"));
    }
    if (!_ParseCookie(&cookie, info[3])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = lcb_get(me->getLcbHandle(), cookie, 1, cmd);
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnUnlock) {
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    LcbCmd<lcb_unlock_cmd_t> cmd;
    void *cookie;
    Nan::HandleScope scope;

    cmd->version = 0;
    if (!_ParseKey(&cmd->v.v0, info[0])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!_ParseHashkey(&cmd->v.v0, info[1])) {
        return Nan::ThrowError(Error::create("bad hashkey passed"));
    }
    if (!_ParseCas(&cmd->v.v0, info[2])) {
        return Nan::ThrowError(Error::create("bad cas passed"));
    }
    if (!_ParseCookie(&cookie, info[3])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = lcb_unlock(me->getLcbHandle(), cookie, 1, cmd);
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnRemove) {
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
      LcbCmd<lcb_remove_cmd_t> cmd;
      void *cookie;
      Nan::HandleScope scope;

      cmd->version = 0;
      if (!_ParseKey(&cmd->v.v0, info[0])) {
          return Nan::ThrowError(Error::create("bad key passed"));
      }
      if (!_ParseHashkey(&cmd->v.v0, info[1])) {
          return Nan::ThrowError(Error::create("bad hashkey passed"));
      }
      if (!_ParseCas(&cmd->v.v0, info[2])) {
          return Nan::ThrowError(Error::create("bad cas passed"));
      }
      if (!_ParseCookie(&cookie, info[3])) {
          return Nan::ThrowError(Error::create("bad callback passed"));
      }

      lcb_error_t err = lcb_remove(me->getLcbHandle(), cookie, 1, cmd);
      if (err) {
          return Nan::ThrowError(Error::create(err));
      }

      return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnStore) {
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    LcbCmd<lcb_store_cmd_t> cmd;
    void *cookie;
    Nan::HandleScope scope;

    cmd->version = 0;
    cmd->v.v0.datatype = 0;
    if (!_ParseKey(&cmd->v.v0, info[0])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!_ParseHashkey(&cmd->v.v0, info[1])) {
        return Nan::ThrowError(Error::create("bad hashkey passed"));
    }

    DefaultTranscoder encoder;
    me->encodeDoc(encoder, &cmd->v.v0.bytes, &cmd->v.v0.nbytes,
            &cmd->v.v0.flags, info[2]);

    if (!info[3]->IsUndefined() && !info[3]->IsNull() && !_ParseUintOption(&cmd->v.v0.flags, info[3])) {
        return Nan::ThrowError(Error::create("bad flags passed"));
    }
    if (!_ParseUintOption(&cmd->v.v0.exptime, info[4])) {
        return Nan::ThrowError(Error::create("bad expiry passed"));
    }
    if (!_ParseCas(&cmd->v.v0, info[5])) {
        return Nan::ThrowError(Error::create("bad cas passed"));
    }
    if (!_ParseUintOption(&cmd->v.v0.operation, info[6])) {
        return Nan::ThrowError(Error::create("bad operation passed"));
    }

    if (!_ParseCookie(&cookie, info[7])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    if (cmd->v.v0.operation == LCB_APPEND
          || cmd->v.v0.operation == LCB_PREPEND) {
        cmd->v.v0.flags = 0;
    }

    lcb_error_t err = lcb_store(me->getLcbHandle(), cookie, 1, cmd);
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnArithmetic) {
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    LcbCmd<lcb_arithmetic_cmd_st> cmd;
    void *cookie;
    Nan::HandleScope scope;

    cmd->version = 0;
    if (!_ParseKey(&cmd->v.v0, info[0])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!_ParseHashkey(&cmd->v.v0, info[1])) {
        return Nan::ThrowError(Error::create("bad hashkey passed"));
    }
    if (!_ParseUintOption(&cmd->v.v0.exptime, info[2])) {
        return Nan::ThrowError(Error::create("bad expiry passed"));
    }
    if (!_ParseIntOption(&cmd->v.v0.delta, info[3])) {
        return Nan::ThrowError(Error::create("bad delta passed"));
    }
    if (!_ParseUintOption(&cmd->v.v0.initial, info[4])) {
        return Nan::ThrowError(Error::create("bad initial passed"));
    }
    if (!info[4]->IsUndefined() && !info[4]->IsNull()) {
        cmd->v.v0.create = 1;
    }
    if (!_ParseCookie(&cookie, info[5])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = lcb_arithmetic(me->getLcbHandle(), cookie, 1, cmd);
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnDurability) {
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    LcbCmd<lcb_durability_cmd_t> cmd;
    lcb_durability_opts_t opts;
    void *cookie;
    Nan::HandleScope scope;

    cmd->version = 0;
    memset(&opts, 0, sizeof(opts));

    if (!_ParseKey(&cmd->v.v0, info[0])) {
        return Nan::ThrowError(Error::create("bad key passed"));
    }
    if (!_ParseHashkey(&cmd->v.v0, info[1])) {
        return Nan::ThrowError(Error::create("bad hashkey passed"));
    }
    if (!_ParseCas(&cmd->v.v0, info[2])) {
        return Nan::ThrowError(Error::create("bad cas passed"));
    }

    if (!_ParseUintOption(&opts.v.v0.persist_to, info[3])) {
        return Nan::ThrowError(Error::create("bad persist_to passed"));
    }
    if (!_ParseUintOption(&opts.v.v0.replicate_to, info[4])) {
        return Nan::ThrowError(Error::create("bad replicate_to passed"));
    }
    if (!_ParseUintOption(&opts.v.v0.check_delete, info[5])) {
        return Nan::ThrowError(Error::create("bad check_delete passed"));
    }

    if (!_ParseCookie(&cookie, info[6])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = lcb_durability_poll(me->getLcbHandle(), cookie, &opts, 1, cmd);
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

    memset(&cmd, 0, sizeof(cmd));
    cmd.callback = viewrow_callback;

    if (info[0]->BooleanValue()) {
        cmd.cmdflags |= LCB_CMDVIEWQUERY_F_SPATIAL;
    }

    if (!_ParseString<PS_DDOC>(&cmd.ddoc, &cmd.nddoc, info[1])) {
        return Nan::ThrowError(Error::create("bad ddoc passed"));
    }
    if (!_ParseString<PS_VIEW>(&cmd.view, &cmd.nview, info[2])) {
        return Nan::ThrowError(Error::create("bad view passed"));
    }
    if (!_ParseString<PS_OPTSTR,8192>(&cmd.optstr, &cmd.noptstr, info[3])) {
        return Nan::ThrowError(Error::create("bad optstr passed"));
    }
    if (info[4]->BooleanValue()) {
        cmd.cmdflags |= LCB_CMDVIEWQUERY_F_INCLUDE_DOCS;
    }

    if (!_ParseCookie(&cookie, info[5])) {
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

    Local<Function> jsonStringifyLcl = Nan::New(CouchbaseImpl::jsonStringify);

    memset(&cmd, 0, sizeof(cmd));
    cmd.callback = n1qlrow_callback;
    cmd.content_type = "application/json";

    if (!info[0]->IsUndefined()) {
        if(!_ParseString<PS_HOST>(&cmd.host, (size_t*)NULL, info[0])) {
            return Nan::ThrowError(Error::create("bad host passed"));
        }
    }

    Handle<Value> optsinfo[] = { info[1] };
    Local<Value> optsVal =
            jsonStringifyLcl->Call(Nan::GetCurrentContext()->Global(), 1, optsinfo);
    Local<String> optsStr = optsVal.As<String>();
    if (!_ParseString<PS_QUERY,8192>(&cmd.query, &cmd.nquery, optsStr)) {
        return Nan::ThrowError(Error::create("bad opts passed"));
    }

    if (!info[2]->BooleanValue()) {
        cmd.cmdflags |= LCB_CMDN1QL_F_PREPCACHE;
    }

    if (!_ParseCookie(&cookie, info[3])) {
        return Nan::ThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = lcb_n1ql_query(me->getLcbHandle(), cookie, &cmd);
    if (err) {
        return Nan::ThrowError(Error::create(err));
    }

    return info.GetReturnValue().Set(true);
}
