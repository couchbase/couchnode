#define LCB_NO_DEPR_CXX_CTORS
#undef NDEBUG

#include <libcouchbase/couchbase.h>
#include <libcouchbase/api3.h>
#include <assert.h>
#include <string.h>

static void
op_callback(lcb_t, int cbtype, const lcb_RESPBASE *rb)
{
    fprintf(stderr, "Got callback for %s.. ", lcb_strcbtype(cbtype));
    if (rb->rc != LCB_SUCCESS && rb->rc != LCB_SUBDOC_MULTI_FAILURE) {
        fprintf(stderr, "Operation failed (%s)\n", lcb_strerror(NULL, rb->rc));
        return;
    }

    if (cbtype == LCB_CALLBACK_GET) {
        const lcb_RESPGET *rg = reinterpret_cast<const lcb_RESPGET*>(rb);
        fprintf(stderr, "Value %.*s\n", (int)rg->nvalue, rg->value);
    } else if (cbtype == LCB_CALLBACK_SDMUTATE || cbtype == LCB_CALLBACK_SDLOOKUP) {
        const lcb_RESPSUBDOC *resp = reinterpret_cast<const lcb_RESPSUBDOC*>(rb);
        lcb_SDENTRY ent;
        size_t iter = 0;
        if (lcb_sdresult_next(resp, &ent, &iter)) {
            fprintf(stderr, "Status: 0x%x. Value: %.*s\n", ent.status, (int)ent.nvalue, ent.value);
        } else {
            fprintf(stderr, "No result!\n");
        }
    } else {
        fprintf(stderr, "OK\n");
    }
}

// Function to issue an lcb_get3() (and print the state of the document)
static void
demoKey(lcb_t instance, const char *key)
{
    printf("Retrieving '%s'\n", key);
    printf("====\n");
    lcb_CMDGET gcmd = { 0 };
    LCB_CMD_SET_KEY(&gcmd, key, strlen(key));
    lcb_error_t rc = lcb_get3(instance, NULL, &gcmd);
    assert(rc == LCB_SUCCESS);
    lcb_wait(instance);
    printf("====\n\n");
}

// cluster_run mode
#define DEFAULT_CONNSTR "couchbase://localhost"
int main(int argc, char **argv)
{
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

    lcb_install_callback3(instance, LCB_CALLBACK_DEFAULT, op_callback);

    // Store the initial document. Subdocument operations cannot create
    // documents
    printf("Storing the initial item..\n");
    // Store an item
    lcb_CMDSTORE scmd = { 0 };
    scmd.operation = LCB_SET;
    LCB_CMD_SET_KEY(&scmd, "key", 3);
    const char *initval = "{\"hello\":\"world\"}";
    LCB_CMD_SET_VALUE(&scmd, initval, strlen(initval));
    rc = lcb_store3(instance, NULL, &scmd);
    assert(rc == LCB_SUCCESS);
    lcb_wait(instance);

    lcb_CMDSUBDOC cmd;
    lcb_SDSPEC spec;
    memset(&cmd, 0, sizeof cmd);
    memset(&spec, 0, sizeof spec);

    /**
     * Retrieve a single item from a document
     */
    printf("Getting the 'hello' path from the document\n");
    LCB_CMD_SET_KEY(&cmd, "key", 3);
    // Subdocument commands are composed of one or more lcb_SDSPEC objects
    // Assign the spec to the command. In this case our "list" is a single spec.
    // See subdoc-multi.cc for an example using multiple specs
    cmd.specs = &spec;
    cmd.nspecs = 1;
    // Populate the spec
    spec.sdcmd = LCB_SDCMD_GET;
    LCB_SDSPEC_SET_PATH(&spec, "hello", 5);
    rc = lcb_subdoc3(instance, NULL, &cmd);
    assert(rc == LCB_SUCCESS);
    lcb_wait(instance);

    /**
     * Set a dictionary/object field
     */
    memset(&cmd, 0, sizeof cmd);
    memset(&spec, 0, sizeof spec);

    printf("Adding new 'goodbye' path to document\n");
    LCB_CMD_SET_KEY(&cmd, "key", 3);
    cmd.specs = &spec;
    cmd.nspecs = 1;

    spec.sdcmd = LCB_SDCMD_DICT_UPSERT;
    LCB_SDSPEC_SET_PATH(&spec, "goodbye", 7);
    LCB_SDSPEC_SET_VALUE(&spec, "\"world\"", 7);

    rc = lcb_subdoc3(instance, NULL, &cmd);
    assert(rc == LCB_SUCCESS);
    lcb_wait(instance);
    demoKey(instance, "key");

    /**
     * Add new element to end of an array
     */
    memset(&cmd, 0, sizeof cmd);
    memset(&spec, 0, sizeof spec);
    // Options can also be used
    printf("Appending element to array (array might be missing)\n");
    LCB_CMD_SET_KEY(&cmd, "key", 3);
    cmd.specs = &spec;
    cmd.nspecs = 1;

    // "push" to the end of the array
    spec.sdcmd = LCB_SDCMD_ARRAY_ADD_LAST;

    // Create the array if it doesn't exist. This option can be used with
    // other commands as well..
    spec.options = LCB_SDSPEC_F_MKINTERMEDIATES;

    LCB_SDSPEC_SET_PATH(&spec, "array", 5);
    LCB_SDSPEC_SET_VALUE(&spec, "1", 1);
    rc = lcb_subdoc3(instance, NULL, &cmd);
    assert(rc == LCB_SUCCESS);
    lcb_wait(instance);
    demoKey(instance, "key");

    /**
     * Add element to the beginning of an array
     */
    memset(&spec, 0, sizeof spec);
    memset(&cmd, 0, sizeof cmd);
    printf("Prepending element to array (array must exist)\n");
    LCB_CMD_SET_KEY(&cmd, "key", 3);
    cmd.specs = &spec;
    cmd.nspecs = 1;

    spec.sdcmd = LCB_SDCMD_ARRAY_ADD_FIRST;
    LCB_SDSPEC_SET_PATH(&spec, "array", 5);
    LCB_SDSPEC_SET_VALUE(&spec, "2", 1);
    rc = lcb_subdoc3(instance, NULL, &cmd);
    assert(rc == LCB_SUCCESS);
    lcb_wait(instance);
    demoKey(instance, "key");

    /**
     * Get the first element back..
     */
    memset(&spec, 0, sizeof spec);
    memset(&cmd, 0, sizeof cmd);
    printf("Getting first array element...\n");
    LCB_CMD_SET_KEY(&cmd, "key", 3);
    cmd.specs = &spec;
    cmd.nspecs = 1;

    spec.sdcmd = LCB_SDCMD_GET;
    LCB_SDSPEC_SET_PATH(&spec, "array[0]", strlen("array[0]"));
    rc = lcb_subdoc3(instance, NULL, &cmd);
    assert(rc == LCB_SUCCESS);
    lcb_wait(instance);

    lcb_destroy(instance);
    return 0;
}
