#ifndef CBC_HISTOGRAM_H
#define CBC_HISTOGRAM_H
#include <libcouchbase/couchbase.h>
#include <stdio.h>

namespace cbc {

class Histogram {
public:
    Histogram() { hg = NULL; output = NULL; }
    void install(lcb_t, FILE *out = stderr);
    void installStandalone(FILE *out = stderr);
    void record(lcb_U64 duration);
    void write();
    FILE *getOutput() const { return output; }
private:
    lcb_HISTOGRAM *hg;
    FILE *output;
};

}

#endif
