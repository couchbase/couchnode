#include "lcb_luv_test.h"

YOLOG_STATIC_INIT("test", YOLOG_DEBUG);

uv_loop_t *Loop;
uv_prepare_t Prepare;
uv_check_t Check;

/**
 * State transitioning
 */
void
stop_callback(struct lcb_luv_cookie_st *cookie)
{
    yolog_err("stop_event_loop(). Will invoke next state");
    struct continuation_st *cont = cookie->data, next;
    if (cont == NULL || cont->cb == NULL) {
        exit(0);
    }

    next = cont->cb(cont);
    free(cont);

    if (next.stop) {
        cookie->data = NULL;
    } else {
        cookie->data = malloc(sizeof(next));
        *(struct continuation_st*)cookie->data = next;
    }
}


void
start_callback(struct lcb_luv_cookie_st *cookie)
{
    yolog_err("run_event_loop()");
}



void
prepare_callback(uv_prepare_t *prep, int status)
{
    yolog_debug("Prepare");
}

void
check_callback(uv_check_t *check, int status)
{
    yolog_debug("Check..");
}

void
lcb_error_callback(libcouchbase_t instance,
                   libcouchbase_error_t error,
                   const char *errinfo)
{
    printf("Got error %d: %s\n", error, errinfo);
    abort();
}

int main(void) {
    libcouchbase_t instance;
    struct libcouchbase_io_opt_st *iops;
    struct lcb_luv_cookie_st *cookie;
    struct continuation_st *cont;

    libcouchbase_error_t err;
    Loop = uv_default_loop();
    assert(Loop);
    iops = lcb_luv_create_io_opts(Loop, 1024);
    cookie = lcb_luv_from_iops(iops);

    cookie->start_callback = start_callback;
    cookie->stop_callback = stop_callback;
    cookie->data = instance;

    uv_prepare_init(Loop, &Prepare);
    uv_check_init(Loop, &Check);


    instance = libcouchbase_create("10.0.0.99:8091",
            "Administrator", "123456", "membase0",
            iops);

    assert(instance);
    libcouchbase_set_error_callback(instance, lcb_error_callback);
    err = libcouchbase_connect(instance);
    assert(err == LIBCOUCHBASE_SUCCESS);
    yolog_info("connect() returns OK");

    uv_prepare_start(&Prepare, prepare_callback);
    uv_check_start(&Check, check_callback);

    cont = malloc(sizeof(*cont));
    cont->instance = instance;
    cont->cookie = cookie;
    cont->cb = t00_contcb_set;
    cookie->data = cont;


    libcouchbase_wait(instance);

    uv_run(Loop);

    return 0;
}
