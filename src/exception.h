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


#ifndef COUCHBASE_EXCEPTION_H
#define COUCHBASE_EXCEPTION_H
#ifndef COUCHBASE_H
#error "include couchbase_impl.h first"
#endif

namespace Couchnode
{
/**
 * Base class of the Exceptions thrown by the internals of
 * Couchnode
 */


class ErrorCode {
public:
    enum {
        BEGIN = 0x1000,
        MEMORY,
        ARGUMENTS,
        INTERNAL,
        SCHEDULING,
        CHECK_RESULTS,
        GENERIC,
        DURABILITY_FAILED
    };
};

class CBExc
{

public:
    CBExc(const char *, const Handle<Value>);
    CBExc();
    virtual ~CBExc();

    void assign(int cc, const std::string & msg = "") {
        if (set_) { return; }

        if (msg.empty() && isLcbError(cc)) {
            message = lcb_strerror(NULL, (lcb_error_t)cc);
        } else {
            message = msg;
        }
        code = cc;
        set_ = true;
    }


    // Handy method to assign an argument error
    // These all return the object so one can do:
    // CBExc().eArguments().throwV8();

    CBExc& eArguments(const std::string& msg = "", Handle<Value> at = Handle<Value>()) {
        if (set_) {
            return *this;
        }
        assign(ErrorCode::ARGUMENTS);
        setMessage(msg, at);
        return *this;
    }

    CBExc& eMemory(const std::string& msg = "") {
        assign(ErrorCode::MEMORY, msg);
        return *this;
    }

    CBExc& eInternal(const std::string &msg = "") {
        assign(ErrorCode::INTERNAL, msg);
        return *this;
    }

    CBExc& eLcb(lcb_error_t err) {
        assign(err);
        return *this;
    }

    virtual const std::string &getMessage() const {
        return message;
    }

    virtual std::string formatMessage() const;

    Handle<Value> throwV8() {
        assert(isSet());
        assert(!(message.empty() && code != 0));
        // v8::Message::PrintCurrentStackTrace(stderr);
        return throwV8Object();
    }

    Handle<Value> asValue();


    Handle<Value> throwV8Object() {
        return v8::ThrowException(asValue());
    }

#if 0
    Handle<Value> throwV8String() {
        return v8::ThrowException(String::New(formatMessage().c_str()));
    }
#endif

    bool isSet() const { return set_; }
    bool hasObject() const { return obj_set_; }
    void setMessage(const std::string &msg = "",
                    Handle<Value> val = Handle<Value>());

    void setMessage(const char *s) {
        setMessage(std::string(s));
    }

    // Returns true if the error is a libcouchbase code, false otherwise.
    // note the code *must* be either an
    static bool isLcbError(int cc) { return cc < ErrorCode::BEGIN; }


protected:
    Persistent<Value> atObject;
    std::string message;
    int code;
    bool set_ : 1;
    bool obj_set_ : 1;

private:
    CBExc(CBExc&);
};

}

#endif
