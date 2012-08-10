#include "lcb_luv_test.h"
#include <assert.h>

YOLOG_STATIC_INIT("simple1", YOLOG_DEBUG);

#define MY_KEY "LibcouchbaseLove"
#define MY_VALUE "LibcouchbaseLovesValue"

static
DECLARE_CONTINUATION(t00_contcb_get);

static
DECLARE_CONTINUATION(t00_contcb_next);


static void store_callback STORAGE_CB_PROTOTYPE
{
    assert(error == LIBCOUCHBASE_SUCCESS);
    yolog_err("Set callback successful");

}

static void get_callback GET_CB_PROTOTYPE
{
    assert(error == LIBCOUCHBASE_SUCCESS);
    assert(nkey == sizeof(MY_KEY));
    assert(nbytes == sizeof(MY_VALUE));
    assert(memcmp(MY_KEY, key, sizeof(MY_KEY)) == 0);
    assert(memcmp(MY_VALUE, bytes, sizeof(MY_VALUE)) == 0);
    yolog_err("Get callback successful");
}

struct continuation_st
t00_contcb_set(struct continuation_st *cont)
{
    libcouchbase_error_t err;

    yolog_err("Hello World!");

    libcouchbase_set_storage_callback(cont->instance, store_callback);
    libcouchbase_set_get_callback(cont->instance, get_callback);

    err = libcouchbase_store(cont->instance, cont, LIBCOUCHBASE_SET,
            MY_KEY, sizeof(MY_KEY), MY_VALUE, sizeof(MY_VALUE), 0, 0, 0);
    assert(err == LIBCOUCHBASE_SUCCESS);
    cont->cb = t00_contcb_get;
    libcouchbase_wait(cont->instance);
    return *cont;
}

static
DECLARE_CONTINUATION(t00_contcb_get)
{
    libcouchbase_error_t err;
    libcouchbase_size_t sz = sizeof(MY_KEY);
    yolog_err("Will try and issue a GET request");
    char *arry[] = { MY_KEY };
    err = libcouchbase_mget(cont->instance, cont, 1, arry, &sz, NULL);
    assert(err == LIBCOUCHBASE_SUCCESS);
    libcouchbase_wait(cont->instance);
    cont->cb = t00_contcb_next;
    return *cont;
}

static
DECLARE_CONTINUATION(t00_contcb_next)
{
    yolog_err("Exiting now..");
    exit(1);
    return *cont;
}
