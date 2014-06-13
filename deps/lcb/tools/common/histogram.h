#ifndef CBC_HISTOGRAM_H
#define CBC_HISTOGRAM_H
#include <libcouchbase/couchbase.h>
#include <stdio.h>

namespace cbc {

class Histogram {
public:
    Histogram() { instance = NULL; output = NULL; }
    void install(lcb_t, FILE *out = stderr);
    void write();
    void disable();
    FILE *getOutput() const { return output; }
private:
    lcb_t instance;
    FILE *output;
};


}

#endif
