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

#ifndef COUCHNODE_COOKIE_H
#define COUCHNODE_COOKIE_H 1

#ifndef COUCHBASE_H
#error "Include couchbase.h before including this file"
#endif

namespace Couchnode
{
using namespace v8;

typedef enum {
    CBMODE_SINGLE,
    CBMODE_SPOOLED
} CallbackMode;

class ResponseInfo {
public:
    lcb_error_t status;
    Handle<Object> payload;

    Handle<Value> getKey() {
        if (keyObj.IsEmpty()) {
            keyObj = String::New((const char *)key, nkey);
        }
        return keyObj;
    }

    bool hasKey() { return key != NULL && nkey > 0; }
    void setField(NameMap::dict_t name, Handle<Value> val) {
        payload->ForceSet(NameMap::names[name], val);
    }

    ~ResponseInfo() {
    }

    ResponseInfo(lcb_error_t, const lcb_get_resp_t*);
    ResponseInfo(lcb_error_t, const lcb_store_resp_t *);
    ResponseInfo(lcb_error_t, const lcb_arithmetic_resp_t*);
    ResponseInfo(lcb_error_t, const lcb_touch_resp_t*);
    ResponseInfo(lcb_error_t, const lcb_unlock_resp_t *);
    ResponseInfo(lcb_error_t, const lcb_remove_resp_t *);
    ResponseInfo(lcb_error_t, const lcb_http_resp_t *);
    ResponseInfo(lcb_error_t, const lcb_observe_resp_t *);
    ResponseInfo(lcb_error_t, const lcb_durability_resp_t *);
    ResponseInfo(lcb_error_t, Handle<Value> kObj);

    const void *key;
    size_t nkey;
    HandleScope scope;
    Handle<Value> keyObj;

private:
    ResponseInfo(ResponseInfo&);

    // Helpers
    void setCas(lcb_cas_t cas) {
        setField(NameMap::CAS, Cas::CreateCas(cas));
    }

    void setValue(Handle<Value>& val) {
        setField(NameMap::VALUE, val);
    }
};

class Cookie
{
public:
    Cookie(unsigned int numRemaining)
        : remaining(numRemaining), cbType(CBMODE_SINGLE), hasError(false),
          isCancelled(false) {}

    void setCallback(Handle<Function> cb, CallbackMode mode) {
        assert(callback.IsEmpty());
        callback = Persistent<Function>::New(cb);
        cbType = mode;

        if (cbType == CBMODE_SPOOLED) {
            spooledInfo = Persistent<Object>::New(Object::New());
        }
    }

    void setParent(v8::Handle<v8::Value> cbo) {
        assert(parent.IsEmpty());
        parent = v8::Persistent<v8::Value>::New(cbo);
    }

    virtual ~Cookie();
    void markProgress(ResponseInfo&);
    virtual void cancel(lcb_error_t err, Handle<Array> keys);

protected:
    Persistent<Object> spooledInfo;
    void invokeFinal();

    // Processed a single command
    bool hasRemaining();
    Persistent<Function> callback;


private:
    unsigned int remaining;
    void addSpooledInfo(Handle<Value>&, ResponseInfo&);
    void invokeSingleCallback(Handle<Value>&, ResponseInfo&);
    void invokeSpooledCallback();

    Persistent<Value> parent;
    CallbackMode cbType;
    bool hasError;
    bool isCancelled;

    // No copying
    Cookie(Cookie&);
};

class StatsCookie : public Cookie
{
public:
    StatsCookie() : Cookie(-1), lastError(LCB_SUCCESS) {}
    virtual void cancel(lcb_error_t, Handle<Array>);
    void update(lcb_error_t, const lcb_server_stat_resp_t *);
private:
    void invoke(lcb_error_t err);
    lcb_error_t lastError;
};

class HttpCookie : public Cookie
{
public:
    HttpCookie() : Cookie(-1) {}
    void update(lcb_error_t, const lcb_http_resp_t *);
    virtual void cancel(lcb_error_t err, Handle<Array>) {
        update(err, NULL);
    }

private:
    lcb_http_request_t htreq;
};

} // namespace Couchnode
#endif // COUCHNODE_COOKIE_H
