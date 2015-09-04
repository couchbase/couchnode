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


#ifndef CAS_H_
#define CAS_H_

namespace Couchnode
{

class Cas
{
public:
    static void Init();
    static NAN_METHOD(fnToString);
    static NAN_METHOD(fnInspect);

    static bool GetCas(v8::Local<v8::Value>, uint64_t*);
    static v8::Handle<v8::Value> CreateCas(uint64_t);

private:
    static Nan::Persistent<v8::Function> casClass;

};

} // namespace Couchnode

#endif /* CAS_H_ */
