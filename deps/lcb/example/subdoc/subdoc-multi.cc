#define LCB_NO_DEPR_CXX_CTORS
#undef NDEBUG

#include <libcouchbase/couchbase.h>
#include <libcouchbase/api3.h>
#include <assert.h>
#include <string.h>
#include <cstdlib>
#include <string>
#include <vector>

static void generic_callback(lcb_t, int type, const lcb_RESPBASE *rb)
{
    printf("Got callback for %s\n", lcb_strcbtype(type));

    if (rb->rc != LCB_SUCCESS && rb->rc != LCB_SUBDOC_MULTI_FAILURE) {
        printf("Failure: 0x%x\n", rb->rc);
        abort();
    }

    if (type == LCB_CALLBACK_GET) {
        const lcb_RESPGET *rg = (const lcb_RESPGET *)rb;
        printf("Result is: %.*s\n", (int)rg->nvalue, rg->value);
    } else if (type == LCB_CALLBACK_SDLOOKUP || type == LCB_CALLBACK_SDMUTATE) {
        lcb_SDENTRY ent;
        size_t iter = 0;
        size_t oix = 0;
        const lcb_RESPSUBDOC *resp = reinterpret_cast<const lcb_RESPSUBDOC*>(rb);
        while (lcb_sdresult_next(resp, &ent, &iter)) {
            size_t index = oix++;
            if (type == LCB_CALLBACK_SDMUTATE) {
                index = ent.index;
            }
            printf("[%lu]: 0x%x. %.*s\n",
                index, ent.status, (int)ent.nvalue, ent.value);
        }
    }
}

// cluster_run mode
#define DEFAULT_CONNSTR "couchbase://localhost"

int main(int argc, char **argv) {
    lcb_create_st crst = { 0 };
    crst.version = 3;
    if (argc > 1) {
        crst.v.v3.connstr = argv[1];
    } else {
        crst.v.v3.connstr = DEFAULT_CONNSTR;
    }
    if (argc > 2) {
        crst.v.v3.username = argv[2];
    } else {
        crst.v.v3.username = "Administrator";
    }
    if (argc > 3) {
        crst.v.v3.passwd = argv[3];
    } else {
        crst.v.v3.passwd = "password";
    }

    lcb_t instance;
    lcb_error_t rc = lcb_create(&instance, &crst);
    assert(rc == LCB_SUCCESS);

    rc = lcb_connect(instance);
    assert(rc == LCB_SUCCESS);
    lcb_wait(instance);
    rc = lcb_get_bootstrap_status(instance);
    assert(rc == LCB_SUCCESS);

    // Install generic callback
    lcb_install_callback3(instance, LCB_CALLBACK_DEFAULT, generic_callback);

    // Store an item
    lcb_CMDSTORE scmd = { 0 };
    scmd.operation = LCB_SET;
    LCB_CMD_SET_KEY(&scmd, "key", 3);
    const char *initval = "{\"hello\":\"world\"}";
    LCB_CMD_SET_VALUE(&scmd, initval, strlen(initval));
    rc = lcb_store3(instance, NULL, &scmd);
    assert(rc == LCB_SUCCESS);

    lcb_CMDSUBDOC mcmd = { 0 };
    LCB_CMD_SET_KEY(&mcmd, "key", 3);

    std::vector<lcb_SDSPEC> specs;
    std::string bufs[10];

    // Add some mutations
    for (int ii = 0; ii < 5; ii++) {
        std::string& path = bufs[ii * 2];
        std::string& val = bufs[(ii * 2) + 1];
        char pbuf[24], vbuf[24];

        sprintf(pbuf, "pth%d", ii);
        sprintf(vbuf, "\"Value_%d\"", ii);
        path = pbuf;
        val = vbuf;

        lcb_SDSPEC spec = { 0 };
        LCB_SDSPEC_SET_PATH(&spec, path.c_str(), path.size());
        LCB_CMD_SET_VALUE(&spec, val.c_str(), val.size());
        spec.sdcmd = LCB_SDCMD_DICT_UPSERT;
        specs.push_back(spec);
    }

    mcmd.specs = specs.data();
    mcmd.nspecs = specs.size();
    rc = lcb_subdoc3(instance, NULL, &mcmd);
    assert(rc == LCB_SUCCESS);

    // Reset the specs
    specs.clear();
    for (int ii = 0; ii < 5; ii++) {
        char pbuf[24];
        std::string& path = bufs[ii];
        sprintf(pbuf, "pth%d", ii);
        path = pbuf;

        lcb_SDSPEC spec = { 0 };
        LCB_SDSPEC_SET_PATH(&spec, path.c_str(), path.size());
        spec.sdcmd = LCB_SDCMD_GET;
        specs.push_back(spec);
    }

    lcb_SDSPEC spec2 = { 0 };
    LCB_SDSPEC_SET_PATH(&spec2, "dummy", 5);
    spec2.sdcmd = LCB_SDCMD_GET;
    specs.push_back(spec2);
    mcmd.specs = specs.data();
    mcmd.nspecs = specs.size();
    rc = lcb_subdoc3(instance, NULL, &mcmd);
    assert(rc == LCB_SUCCESS);

    lcb_CMDGET gcmd = { 0 };
    LCB_CMD_SET_KEY(&gcmd, "key", 3);
    rc = lcb_get3(instance, NULL, &gcmd);
    assert(rc == LCB_SUCCESS);

    lcb_wait(instance);
    lcb_destroy(instance);
}
