/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
#include "couchbase_impl.h"
#include <sstream>
static v8::Persistent<v8::ObjectTemplate> CasTemplate;
using namespace Couchnode;

/**
 * If we have 64 bit pointers we can stuff the pointer into the field and
 * save on having to make a new uint64_t*
 */
#if defined(_LP64) && !defined(COUCHNODE_NO_CASINTPTR)
static inline void *cas_to_pointer(uint64_t cas)
{
    return (void *)(uintptr_t)cas;
}
static inline uint64_t cas_from_pointer(void *ptr)
{
    return (uint64_t)(uintptr_t)ptr;
}
static inline void free_cas_pointer(void *) { }

#else

static inline void *cas_to_pointer(uint64_t cas)
{
    return new uint64_t(cas);
}

static inline uint64_t cas_from_pointer(void *ptr)
{
    if (!ptr) {
        return 0;
    }
    return *(uint64_t *)ptr;
}

static inline void free_cas_pointer(void *ptr)
{
    if (ptr) {
        delete ptr;
    }
}

#endif

void Cas::initialize()
{
    CasTemplate = v8::Persistent<v8::ObjectTemplate>::New(
                      v8::ObjectTemplate::New());
    CasTemplate->SetInternalFieldCount(1);

    CasTemplate->SetAccessor(NameMap::names[NameMap::PROP_STR],
                             GetHumanReadable);
}

static void cas_object_dtor(v8::Persistent<v8::Value> handle, void *)
{
    v8::Handle<v8::Object> obj = v8::Persistent<v8::Object>::Cast(handle);
    free_cas_pointer(obj->GetPointerFromInternalField(0));
    handle.Dispose();
}

v8::Handle<v8::Value> Cas::GetHumanReadable(v8::Local<v8::String>,
                                            const v8::AccessorInfo &accinfo)
{
    std::stringstream ss;
    uint64_t cas = cas_from_pointer(
                       accinfo.This()->GetPointerFromInternalField(0));
    ss << cas;
    return v8::Local<v8::String>(v8::String::New(ss.str().c_str()));
}

v8::Persistent<v8::Object> Cas::CreateCas(uint64_t cas)
{
    v8::Persistent<v8::Object> ret = v8::Persistent<v8::Object>::New(
                                         CasTemplate->NewInstance());

    ret->SetPointerInInternalField(0, cas_to_pointer(cas));
    ret.MakeWeak(NULL, cas_object_dtor);

    return ret;
}

uint64_t Cas::GetCas(v8::Handle<v8::Object> vstr)
{
    uint64_t cas =
        cas_from_pointer(vstr->GetPointerFromInternalField(0));
    if (!cas) {
        throw Couchnode::Exception("Invalid CAS", vstr);
    }
    return cas;
}
