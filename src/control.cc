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
#include "exception.h"

// Thanks mauke
#define STRINGIFY_(X) #X
#define STRINGIFY(X) STRINGIFY_(X)

namespace Couchnode
{

NAN_METHOD(CouchbaseImpl::fnControl)
{
    NanScope();
    CouchbaseImpl *me;
    lcb_t instance;
    lcb_error_t err;

    me = ObjectWrap::Unwrap<CouchbaseImpl>(args.This());
    instance = me->getLcbHandle();

    if (args.Length() < 2) {
        return NanThrowError(Error::create("Too few arguments"));
    }

    int mode = args[0]->IntegerValue();
    int option = args[1]->IntegerValue();

    Handle<Value> optVal = args[2];

    if (option != LCB_CNTL_SET && option != LCB_CNTL_GET) {
        return NanThrowError(Error::create("Invalid option mode"));
    }

    if (option == LCB_CNTL_SET && optVal.IsEmpty()) {
        return NanThrowError(Error::create("Valid argument missing for 'CNTL_SET'"));
    }

    switch (mode) {

    case LCB_CNTL_CONFIGURATION_TIMEOUT:
    case LCB_CNTL_VIEW_TIMEOUT:
    case LCB_CNTL_HTTP_TIMEOUT:
    case LCB_CNTL_DURABILITY_INTERVAL:
    case LCB_CNTL_DURABILITY_TIMEOUT:
    case LCB_CNTL_OP_TIMEOUT:
    {
        lcb_uint32_t tmoval;
        if (option == LCB_CNTL_GET) {
            err =  lcb_cntl(instance, option, mode, &tmoval);
            if (err != LCB_SUCCESS) {
                return NanThrowError(Error::create(err));
            } else {
                NanReturnValue(NanNew<Number>(tmoval / 1000));
            }
        } else {
            tmoval = optVal->NumberValue() * 1000;
            err = lcb_cntl(instance, option, mode, &tmoval);
        }

        break;
    }

    case LCB_CNTL_CONFDELAY_THRESH: {
        lcb_uint32_t tval;

        if (option == LCB_CNTL_GET) {
            err = lcb_cntl(instance, option, mode, &tval);
            if (err != LCB_SUCCESS) {
                return NanThrowError(Error::create("CNTL failed"));
            } else {
                NanReturnValue(NanNew<Number>(tval));
            }
        } else {
            tval = optVal->Uint32Value();
            err = lcb_cntl(instance, option, mode, &tval);
        }
        break;
    }

    case LCB_CNTL_REINIT_CONNSTR: {
        String::Utf8Value s(optVal->ToString());
        err = lcb_cntl(instance, option, mode, (char *)*s);
        break;
     }

    default:
        return NanThrowError(Error::create("Not supported yet"));
    }

    if (err == LCB_SUCCESS) {
        NanReturnValue(NanTrue());
    } else {
        return NanThrowError(Error::create("CNTL failed"));
    }
}

}
