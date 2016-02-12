#include <libcouchbase/couchbase.h>
#include <libcouchbase/api3.h>
#include <libcouchbase/views.h>
#include <string>
#include <cstring>
#include <cstdlib>
#include <cstdio>
#include <cassert>

static int cbCounter = 0;

extern "C" {
static void viewCallback(lcb_t, int, const lcb_RESPVIEWQUERY *rv)
{
    if (rv->rflags & LCB_RESP_F_FINAL) {
        printf("*** META FROM VIEWS ***\n");
        fprintf(stderr, "%.*s\n", (int)rv->nvalue, rv->value);
        return;
    }

    printf("Got row callback from LCB: RC=0x%X, DOCID=%.*s. KEY=%.*s\n",
        rv->rc,
        (int)rv->ndocid, rv->docid,
        (int)rv->nkey, rv->key);

    if (rv->docresp) {
        printf("   Document for response. RC=0x%X. CAS=0x%llx\n",
            rv->docresp->rc, rv->docresp->cas);
    }

    cbCounter++;
}
}

int main(int argc, const char **argv)
{
    lcb_t instance;
    lcb_create_st cropts;
    memset(&cropts, 0, sizeof cropts);
    const char *connstr = "couchbase://localhost/beer-sample";

    if (argc > 1) {
        if (strcmp(argv[1], "--help") == 0) {
            fprintf(stderr, "Usage: %s CONNSTR\n", argv[0]);
            exit(EXIT_SUCCESS);
        } else {
            connstr = argv[1];
        }
    }

    cropts.version = 3;
    cropts.v.v3.connstr = connstr;
    lcb_error_t rc;
    rc = lcb_create(&instance, &cropts);
    assert(rc == LCB_SUCCESS);
    rc = lcb_connect(instance);
    assert(rc == LCB_SUCCESS);
    lcb_wait(instance);
    assert(lcb_get_bootstrap_status(instance) == LCB_SUCCESS);

    // Nao, set up the views..
    lcb_CMDVIEWQUERY vq = { 0 };
    std::string dName = "beer";
    std::string vName = "by_location";
    std::string options = "reduce=false";

    vq.callback = viewCallback;
    vq.ddoc = dName.c_str();
    vq.nddoc = dName.length();
    vq.view = vName.c_str();
    vq.nview = vName.length();
    vq.optstr = options.c_str();
    vq.noptstr = options.size();

    vq.cmdflags = LCB_CMDVIEWQUERY_F_INCLUDE_DOCS;

    rc = lcb_view_query(instance, NULL, &vq);
    assert(rc == LCB_SUCCESS);
    lcb_wait(instance);
    lcb_destroy(instance);
    printf("Total Invocations=%d\n", cbCounter);
    return 0;
}
