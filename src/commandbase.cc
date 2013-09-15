/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2013 Couchbase, Inc.
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

namespace Couchnode {

using namespace v8;

void KeysInfo::setKeys(Handle<Value> k)
{
    keys = k;
    if (keys->IsArray()) {
        kcollType = ArrayKeys;
        ncmds = keys.As<Array>()->Length();

    } else if (keys->IsObject()) {
        kcollType = ObjectKeys;
        Local<Array> propNames(keys.As<Object>()->GetPropertyNames());
        ncmds = propNames->Length();

    } else {
        kcollType = SingleKey;
        ncmds = 1;
    }
}

Handle<Array> KeysInfo::getSafeKeysArray()
{
    if (kcollType == ArrayKeys) {
        return keys.As<Array>()->Clone().As<Array>();
    } else if (kcollType == ObjectKeys) {
        return keys.As<Object>()->GetPropertyNames();
    } else {
        Handle<Array> ret = Array::New(1);
        if (keys.IsEmpty()) {
            ret->Set(0, v8::Undefined());
        } else {
            ret->Set(0, keys);
        }
        return ret;
    }
}

void KeysInfo::makePersistent()
{
    assert(!isPersistent);
    isPersistent = true;
    keys = Persistent<Value>::New(keys);
}

KeysInfo::~KeysInfo()
{
    if (keys.IsEmpty() || isPersistent == false) {
        return;
    }

    Persistent<Value> persist(keys);
    persist.Dispose();
    persist.Clear();
}

bool Command::handleBadString(const char *msg, char **k, size_t *n)
{
    if ((*k = const_cast<char *>(getDefaultString())) != NULL) {
        *n = strlen(*k);
        return true;
    }
    err.eInternal(msg);
    return false;
}

bool Command::getBufBackedString(Handle<Value> v, char **k, size_t *n,
                                 bool addNul)
{
    if (v.IsEmpty()) {
        return handleBadString("IsEmpty returns true", k, n);
    }
    if (!v->IsString() && !v->IsNumber()) {
        return handleBadString("key is not a string", k, n);
    }

    Local<String> s = v->ToString();

    if (s.IsEmpty()) {
        return handleBadString("key is not a string", k, n);
    }

    *n = s->Utf8Length();
    if (!*n) {
        return handleBadString("string is empty", k, n);
    }

    if (addNul) {
        *k = bufs.getBuffer((*n) + 1);
    } else {
        *k = bufs.getBuffer(*n);
    }

    if (!*k) {
        err.eMemory("Couldn't get buffer");
    }

    int nw = s->WriteUtf8(*k, *n, NULL, String::NO_NULL_TERMINATION);
    if (nw < 0 || (unsigned int)nw < *n) {
        err.eInternal("Incomplete conversion");
        return false;
    }

    if (addNul) {
        *(*k + *n) = '\0';
    }

    return true;
}

bool Command::initialize()
{
    keys.setKeys(apiArgs[0]);
    Parameters* params = getParams();

    Handle<Object> objParams(apiArgs[1].As<Object>());

    if (!initCommandList()) {
        err.eMemory("Command list");
        return false;
    }

    if (params != NULL && objParams.IsEmpty() == false) {
        if (!params->parseObject(objParams, err)) {
            return false;
        }
    }

    if (!parseCommonOptions(objParams)) {
        return false;
    }

    return true;
}


bool Command::processSingle(Handle<Value> single,
                            Handle<Value> options,
                            unsigned int ix)
{
    char *k, *hashkey = NULL;
    size_t n, nhashkey = 0;

    HashkeyOption hkOpt;
    ParamSlot *spec = { &hkOpt };

    if (!ParamSlot::parseAll(options.As<Object>(), &spec, 1, err)) {
        return false;
    }

    if (hkOpt.isFound()) {
        if (!getBufBackedString(hkOpt.v, &hashkey, &nhashkey)) {
            return false;
        }
    } else if (globalHashkey.isFound()) {
        if (!getBufBackedString(globalHashkey.v, &hashkey, &nhashkey)) {
            return false;
        }
    }

    if (!getBufBackedString(single, &k, &n)) {
        return false;
    }

    CommandKey ck;
    ck.setKeys(single, k, n, hashkey, nhashkey);

    return getHandler()(this, ck, options, ix);
}

bool Command::processArray(Handle<Array> arry)
{
    Handle<Value> dummy;
    for (unsigned int ii = 0; ii < arry->Length(); ii++) {
        Handle<Value> cur = arry->Get(ii);
        if (!processSingle(cur, dummy, ii)) {
            return false;
        }
    }

    return true;
}

bool Command::processObject(Handle<Object> obj)
{


    Handle<Array> dKeys = obj->GetPropertyNames();
    for (unsigned int ii = 0; ii < dKeys->Length(); ii++) {
        Handle<Value> curKey = dKeys->Get(ii);
        Handle<Value> curValue = obj->Get(curKey);

        if (!processSingle(curKey, curValue, ii)) {
            return false;
        }
    }

    return true;
}

bool Command::process(ItemHandler handler)
{
    switch (keys.getType()) {
    case KeysInfo::SingleKey: {
        Handle<Value> v;
        return processSingle(keys.getKeys(), v, 0);
    }

    case KeysInfo::ArrayKeys: {
        Handle<Array> arr = Handle<Array>::Cast(keys.getKeys());
        return processArray(arr);
    }

    case KeysInfo::ObjectKeys: {
        Handle<Object> obj = Handle<Object>::Cast(keys.getKeys());
        return processObject(obj);
    }

    default:
        abort();
        break;


    }
    return false;
}

bool Command::parseCommonOptions(const Handle<Object> obj)
{
    if (!callback.parseValue(apiArgs[apiArgs.Length()-1], err)) {
        return false;
    }

    ParamSlot *spec[] = { &isSpooled, &globalHashkey };

    if (!ParamSlot::parseAll(obj, spec, 2, err)) {
        return false;
    }

    if (!callback.isFound()) {
        err.eArguments("Missing callback");
        return false;
    }

    return true;
}

Cookie* Command::createCookie()
{
    if (cookie) {
        return cookie;
    }

    cookie = new Cookie(keys.size());
    initCookie();
    return cookie;
}

void Command::setCookieKeyOption(Handle<Value> key, Handle<Value> option)
{
    if (cookieKeyOptions.IsEmpty()) {
        cookieKeyOptions = Object::New();
    }
    cookieKeyOptions->ForceSet(key, option);
}

void Command::initCookie()
{
    CallbackMode cbMode;
    if (isSpooled.isFound() && isSpooled.v) {
        cbMode = CBMODE_SPOOLED;
    } else {
        cbMode = CBMODE_SINGLE;
    }

    if (!cookieKeyOptions.IsEmpty()) {
        cookie->setOptions(cookieKeyOptions);
    }

    cookie->setCallback(callback.v, cbMode);
}

Command* Command::makePersistent()
{
    Command *ret = copy();
    ret->keys.makePersistent();
    detachCookie();
    return ret;
}

Command::Command(Command &other)
    : apiArgs(other.apiArgs), cookie(other.cookie), bufs(other.bufs) {}

};
