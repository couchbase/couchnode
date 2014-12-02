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

bool _ParseCookie(void ** cookie, Handle<Value> callback) {
  if (callback->IsFunction()) {
    *cookie = new NanCallback(callback.As<v8::Function>());
    return true;
  }
  return false;
}

template <typename T>
bool _ParseKey(T* cmdV, Handle<Value> key) {
  static char keyBuffer[256];
  cmdV->key = _NanRawString(key, Nan::UTF8, (size_t*)&cmdV->nkey,
          keyBuffer, 256, v8::String::NO_OPTIONS);
  return true;
}

template <typename T>
bool _ParseHashkey(T* cmdV, Handle<Value> hashkey) {
  static char hkeyBuffer[256];
  if (!hashkey->IsUndefined() && !hashkey->IsNull()) {
      cmdV->hashkey = _NanRawString(hashkey, Nan::UTF8, (size_t*)&cmdV->nhashkey,
              hkeyBuffer, 256, v8::String::NO_OPTIONS);
  }
  return true;
}

template <typename T>
bool _ParseCas(T* cmdV, Handle<Value> cas) {
    Cas::GetCas(cas, &cmdV->cas);
    return true;
}

template<typename T>
bool _ParseUintOption(T *out, Handle<Value> value) {
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
bool _ParseIntOption(T *out, Handle<Value> value) {
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
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(args.This());
    LcbCmd<lcb_get_cmd_st> cmd;
    void *cookie;
    NanScope();

    cmd->version = 0;
    if (!_ParseKey(&cmd->v.v0, args[0])) {
        return NanThrowError(Error::create("bad key passed"));
    }
    if (!_ParseHashkey(&cmd->v.v0, args[1])) {
        return NanThrowError(Error::create("bad hashkey passed"));
    }
    if (!_ParseUintOption(&cmd->v.v0.exptime, args[2])) {
        return NanThrowError(Error::create("bad expiry passed"));
    }
    if (!_ParseUintOption(&cmd->v.v0.lock, args[3])) {
        return NanThrowError(Error::create("bad locked passed"));
    }
    if (!_ParseCookie(&cookie, args[4])) {
        return NanThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = lcb_get(me->getLcbHandle(), cookie, 1, cmd);
    if (err) {
        return NanThrowError(Error::create(err));
    }

    NanReturnValue(NanTrue());
}

NAN_METHOD(CouchbaseImpl::fnGetReplica) {
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(args.This());
    LcbCmd<lcb_get_replica_cmd_t> cmd;
    void *cookie;
    NanScope();

    cmd->version = 1;
    if (!_ParseKey(&cmd->v.v0, args[0])) {
        return NanThrowError(Error::create("bad key passed"));
    }
    if (!_ParseHashkey(&cmd->v.v0, args[1])) {
        return NanThrowError(Error::create("bad hashkey passed"));
    }
    if (args[2]->IsUndefined() || args[2]->IsNull()) {
        cmd->v.v1.strategy = LCB_REPLICA_FIRST;
    } else {
        cmd->v.v1.strategy = LCB_REPLICA_SELECT;
        if (!_ParseUintOption(&cmd->v.v1.index, args[2])) {
            return NanThrowError(Error::create("bad index passed"));
        }
    }

    if (!_ParseCookie(&cookie, args[3])) {
        return NanThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = lcb_get_replica(me->getLcbHandle(), cookie, 1, cmd);
    if (err) {
        return NanThrowError(Error::create(err));
    }

    NanReturnValue(NanTrue());
}

NAN_METHOD(CouchbaseImpl::fnTouch) {
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(args.This());
    LcbCmd<lcb_get_cmd_st> cmd;
    void *cookie;
    NanScope();

    cmd->version = 0;
    if (!_ParseKey(&cmd->v.v0, args[0])) {
        return NanThrowError(Error::create("bad key passed"));
    }
    if (!_ParseHashkey(&cmd->v.v0, args[1])) {
        return NanThrowError(Error::create("bad hashkey passed"));
    }
    if (!_ParseUintOption(&cmd->v.v0.exptime, args[2])) {
        return NanThrowError(Error::create("bad expiry passed"));
    }
    if (!_ParseCookie(&cookie, args[3])) {
        return NanThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = lcb_get(me->getLcbHandle(), cookie, 1, cmd);
    if (err) {
        return NanThrowError(Error::create(err));
    }

    NanReturnValue(NanTrue());
}

NAN_METHOD(CouchbaseImpl::fnUnlock) {
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(args.This());
    LcbCmd<lcb_unlock_cmd_t> cmd;
    void *cookie;
    NanScope();

    cmd->version = 0;
    if (!_ParseKey(&cmd->v.v0, args[0])) {
        return NanThrowError(Error::create("bad key passed"));
    }
    if (!_ParseHashkey(&cmd->v.v0, args[1])) {
        return NanThrowError(Error::create("bad hashkey passed"));
    }
    if (!_ParseCas(&cmd->v.v0, args[2])) {
        return NanThrowError(Error::create("bad cas passed"));
    }
    if (!_ParseCookie(&cookie, args[3])) {
        return NanThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = lcb_unlock(me->getLcbHandle(), cookie, 1, cmd);
    if (err) {
        return NanThrowError(Error::create(err));
    }

    NanReturnValue(NanTrue());
}

NAN_METHOD(CouchbaseImpl::fnRemove) {
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(args.This());
      LcbCmd<lcb_remove_cmd_t> cmd;
      void *cookie;
      NanScope();

      cmd->version = 0;
      if (!_ParseKey(&cmd->v.v0, args[0])) {
          return NanThrowError(Error::create("bad key passed"));
      }
      if (!_ParseHashkey(&cmd->v.v0, args[1])) {
          return NanThrowError(Error::create("bad hashkey passed"));
      }
      if (!_ParseCas(&cmd->v.v0, args[2])) {
          return NanThrowError(Error::create("bad cas passed"));
      }
      if (!_ParseCookie(&cookie, args[3])) {
          return NanThrowError(Error::create("bad callback passed"));
      }

      lcb_error_t err = lcb_remove(me->getLcbHandle(), cookie, 1, cmd);
      if (err) {
          return NanThrowError(Error::create(err));
      }

      NanReturnValue(NanTrue());
}

NAN_METHOD(CouchbaseImpl::fnStore) {
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(args.This());
    LcbCmd<lcb_store_cmd_t> cmd;
    void *cookie;
    NanScope();

    cmd->version = 0;
    cmd->v.v0.datatype = 0;
    if (!_ParseKey(&cmd->v.v0, args[0])) {
        return NanThrowError(Error::create("bad key passed"));
    }
    if (!_ParseHashkey(&cmd->v.v0, args[1])) {
        return NanThrowError(Error::create("bad hashkey passed"));
    }

    DefaultTranscoder encoder;
    me->encodeDoc(encoder, &cmd->v.v0.bytes, &cmd->v.v0.nbytes,
            &cmd->v.v0.flags, args[2]);

    if (!_ParseUintOption(&cmd->v.v0.exptime, args[3])) {
        return NanThrowError(Error::create("bad expiry passed"));
    }
    if (!_ParseCas(&cmd->v.v0, args[4])) {
        return NanThrowError(Error::create("bad cas passed"));
    }
    if (!_ParseUintOption(&cmd->v.v0.operation, args[5])) {
        return NanThrowError(Error::create("bad operation passed"));
    }

    if (!_ParseCookie(&cookie, args[6])) {
        return NanThrowError(Error::create("bad callback passed"));
    }

    if (cmd->v.v0.operation == LCB_APPEND
          || cmd->v.v0.operation == LCB_PREPEND) {
        cmd->v.v0.flags = 0;
    }

    lcb_error_t err = lcb_store(me->getLcbHandle(), cookie, 1, cmd);
    if (err) {
        return NanThrowError(Error::create(err));
    }

    NanReturnValue(NanTrue());
}

NAN_METHOD(CouchbaseImpl::fnArithmetic) {
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(args.This());
    LcbCmd<lcb_arithmetic_cmd_st> cmd;
    void *cookie;
    NanScope();

    cmd->version = 0;
    if (!_ParseKey(&cmd->v.v0, args[0])) {
        return NanThrowError(Error::create("bad key passed"));
    }
    if (!_ParseHashkey(&cmd->v.v0, args[1])) {
        return NanThrowError(Error::create("bad hashkey passed"));
    }
    if (!_ParseUintOption(&cmd->v.v0.exptime, args[2])) {
        return NanThrowError(Error::create("bad expiry passed"));
    }
    if (!_ParseIntOption(&cmd->v.v0.delta, args[3])) {
        return NanThrowError(Error::create("bad delta passed"));
    }
    if (!_ParseUintOption(&cmd->v.v0.initial, args[4])) {
        return NanThrowError(Error::create("bad initial passed"));
    }
    if (!args[4]->IsUndefined() && !args[4]->IsNull()) {
        cmd->v.v0.create = 1;
    }
    if (!_ParseCookie(&cookie, args[5])) {
        return NanThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = lcb_arithmetic(me->getLcbHandle(), cookie, 1, cmd);
    if (err) {
        return NanThrowError(Error::create(err));
    }

    NanReturnValue(NanTrue());
}

NAN_METHOD(CouchbaseImpl::fnDurability) {
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(args.This());
    LcbCmd<lcb_durability_cmd_t> cmd;
    lcb_durability_opts_t opts;
    void *cookie;
    NanScope();

    cmd->version = 0;
    memset(&opts, 0, sizeof(opts));
    opts.v.v0.timeout = 0;
    opts.v.v0.interval = 0;
    opts.v.v0.cap_max = 1;
    if (!_ParseKey(&cmd->v.v0, args[0])) {
        return NanThrowError(Error::create("bad key passed"));
    }
    if (!_ParseHashkey(&cmd->v.v0, args[1])) {
        return NanThrowError(Error::create("bad hashkey passed"));
    }
    if (!_ParseCas(&cmd->v.v0, args[2])) {
        return NanThrowError(Error::create("bad cas passed"));
    }

    if (!_ParseUintOption(&opts.v.v0.persist_to, args[3])) {
        return NanThrowError(Error::create("bad persist_to passed"));
    }
    if (!_ParseUintOption(&opts.v.v0.replicate_to, args[4])) {
        return NanThrowError(Error::create("bad replicate_to passed"));
    }
    if (!_ParseUintOption(&opts.v.v0.check_delete, args[5])) {
        return NanThrowError(Error::create("bad check_delete passed"));
    }

    if (!_ParseCookie(&cookie, args[6])) {
        return NanThrowError(Error::create("bad callback passed"));
    }

    lcb_error_t err = lcb_durability_poll(me->getLcbHandle(), cookie, &opts, 1, cmd);
    if (err) {
        return NanThrowError(Error::create(err));
    }

    NanReturnValue(NanTrue());
}
