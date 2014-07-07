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

NAN_WEAK_CALLBACK(casDtor) {
    uint64_t *value = data.GetParameter();
    delete value;
}

Handle<Value> Cas::CreateCas(uint64_t cas) {
    Local<Object> ret = NanNew<Object>();
    uint64_t *p = new uint64_t(cas);
    ret->SetIndexedPropertiesToExternalArrayData(
        p, v8::kExternalUnsignedIntArray, 2);
    NanMakeWeakPersistent(ret, p, casDtor);
    return ret;
}

bool Cas::GetCas(Handle<Value> obj, uint64_t *p) {
    Handle<Object> realObj = obj.As<Object>();
    if (!realObj->IsObject()) {
        return false;
    }
    if (realObj->GetIndexedPropertiesExternalArrayDataLength() != 2) {
        return false;
    }

    *p = *(uint64_t*)realObj->GetIndexedPropertiesExternalArrayData();
    return true;
}
