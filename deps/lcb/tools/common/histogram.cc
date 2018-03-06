#include "histogram.h"
#include <string>
using namespace cbc;
using std::string;

void
Histogram::install(lcb_t inst, FILE *out)
{
    lcb_error_t rc;
    output = out;
    lcb_enable_timings(inst);
    rc = lcb_cntl(inst, LCB_CNTL_GET, LCB_CNTL_KVTIMINGS, &hg);
    assert(rc == LCB_SUCCESS);
    assert(hg != NULL);
    (void)rc;
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
    lcb_histogram_print(hg, output);
}

void
Histogram::record(lcb_U64 duration)
{
    if (hg == NULL) {
        return;
    }
    lcb_histogram_record(hg, duration);
}
