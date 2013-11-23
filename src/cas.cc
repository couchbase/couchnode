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
#include <sstream>
using namespace Couchnode;

/**
 * If we have 64 bit pointers we can stuff the pointer into the field and
 * save on having to make a new uint64_t*
 */
#if 0 && defined(_LP64) && !defined(COUCHNODE_NO_CASINTPTR)
// Seems to be broken, so disabling this for now..
Handle<Value> Cas::CreateCas(uint64_t cas)
{
    Handle<Value> ret = External::New((void*)(uintptr_t)cas);
    return ret;
}

bool Cas::GetCas(Handle<Value> obj, uint64_t *p)
{
    if (!obj->IsExternal()) {
        return false;
    }
    *p = (uint64_t)(uintptr_t)(obj.As<External>()->Value());
    return true;
}

#else

static NAN_WEAK_CALLBACK(uint64_t*, casDtor) {
    delete NAN_WEAK_CALLBACK_DATA(uint64_t*);
    NAN_WEAK_CALLBACK_OBJECT.Dispose();
    NAN_WEAK_CALLBACK_OBJECT.Clear();
}


#define CAS_ARRAY_MTYPE kExternalUnsignedIntArray
#define CAS_ARRAY_ELEMENTS 2

Handle<Value> Cas::CreateCas(uint64_t cas) {
    Local<Object> ret = Object::New();
    uint64_t *p = new uint64_t(cas);
    ret->SetIndexedPropertiesToExternalArrayData(p,
                                                 CAS_ARRAY_MTYPE,
                                                 CAS_ARRAY_ELEMENTS);

    NanInitPersistent(Object, retp, ret);
    NanMakeWeak(retp, p, casDtor);
    return ret;
}

bool Cas::GetCas(Handle<Value> obj, uint64_t *p) {
    Handle<Object> realObj = obj.As<Object>();
    if (!realObj->IsObject()) {
        return false;
    }
    if (realObj->GetIndexedPropertiesExternalArrayDataLength()
            != CAS_ARRAY_ELEMENTS) {
        return false;
    }

    *p = *(uint64_t*)realObj->GetIndexedPropertiesExternalArrayData();
    return true;
}
#endif
