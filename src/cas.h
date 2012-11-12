#ifndef CAS_H_
#define CAS_H_

namespace Couchnode
{

    class Cas
    {
    public:

        static void initialize();
        static v8::Persistent<v8::Object> CreateCas(uint64_t);
        static uint64_t GetCas(v8::Handle<v8::Object>);
        static v8::Handle<v8::Value> GetHumanReadable(v8::Local<v8::String>,
                                                      const v8::AccessorInfo &);
    };


} // namespace Couchnode

#endif /* CAS_H_ */
