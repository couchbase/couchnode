#include "histogram.h"
#include <string>
using namespace cbc;
using std::string;

extern "C" {
static void
timings_callback(lcb_t, const void *cookie,
    lcb_timeunit_t timeunit, lcb_uint32_t min, lcb_uint32_t max,
    lcb_uint32_t total, lcb_uint32_t maxtotal)
{
    Histogram *h = (Histogram *)cookie;
    string buf;
    fprintf(h->getOutput(), "[%-4u - %-4u]", min, max);
    const char *unit = NULL;
    if (timeunit == LCB_TIMEUNIT_NSEC) {
        unit = "ns";
    } else if (timeunit == LCB_TIMEUNIT_USEC) {
        unit = "us";
    } else if (timeunit == LCB_TIMEUNIT_MSEC) {
        unit = "ms";
    } else if (timeunit == LCB_TIMEUNIT_SEC) {
        unit = "s";
    } else {
        unit = "?";
    }

    buf += unit;
    int num = static_cast<int>(static_cast<float>(40.0) *
                               static_cast<float>(total) /
                               static_cast<float>(maxtotal));

    buf += " |";
    for (int ii = 0; ii < num; ++ii) {
        buf += '#';
    }
    fprintf(h->getOutput(), "%s - %u\n", buf.c_str(), total);
}
}

void
Histogram::install(lcb_t inst, FILE *out)
{
    this->output = out;
    this->instance = inst;
    lcb_enable_timings(instance);
}

void
Histogram::write()
{
    if (instance == NULL) {
        return;
    }
    lcb_get_timings(instance, this, timings_callback);
}

void
Histogram::disable()
{
    lcb_disable_timings(instance);
    output = NULL;
    instance = NULL;
}
