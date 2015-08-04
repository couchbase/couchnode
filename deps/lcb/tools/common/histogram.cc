#include "histogram.h"
#include <string>
using namespace cbc;
using std::string;

extern "C" {
static void
timings_callback(const void *cookie,
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
    lcb_error_t rc;
    output = out;
    lcb_enable_timings(inst);
    rc = lcb_cntl(inst, LCB_CNTL_GET, LCB_CNTL_KVTIMINGS, &hg);
    assert(rc == LCB_SUCCESS);
    assert(hg != NULL);
}

void
Histogram::installStandalone(FILE *out)
{
    if (hg != NULL) {
        return;
    }
    hg = lcb_histogram_create();
    output = out;
}

void
Histogram::write()
{
    if (hg == NULL) {
        return;
    }
    lcb_histogram_read(hg, this, timings_callback);
}

void
Histogram::record(lcb_U64 duration)
{
    if (hg == NULL) {
        return;
    }
    lcb_histogram_record(hg, duration);
}
