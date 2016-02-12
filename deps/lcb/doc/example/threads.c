#include <pthread.h>
#include <libcouchbase/couchbase.h>
#include <libcouchbase/api3.h>

typedef struct {
    lcb_t instance;
    pthread_mutex_t mutex;
} my_CTX;

/*
 * This function uses the same instance between threads. A lock
 * is required for every operation
 */
static void *
thrfunc_locked(void *arg)
{
    my_CTX *ctx = arg;
    lcb_CMDGET cmd = { 0 };
    LCB_CMD_SET_KEY(&cmd, "Hello", strlen("Hello"));

    pthread_mutex_lock(&ctx->mutex);
    lcb_get3(ctx->instance, NULL, &cmd);
    lcb_wait(ctx->instance);
    pthread_mutex_unlock(&ctx->mutex);
    return NULL;
}

/*
 * This function uses an instance per thread. Since no other thread
 * is using the instance, locking is not required
 */
static void *
thrfunc_unlocked(void *arg)
{
    lcb_t instance;
    lcb_create(&instance, NULL);
    lcb_connect(instance);
    lcb_wait(instance);
    lcb_get_cmd_t cmd = { 0 }, *cmdp = &cmd;
    lcb_get(instance, NULL, 1, &cmdp);
    lcb_wait(instance);
    lcb_destroy(instance);
    return NULL;
}

int main(void)
{
    pthread_t thrs[10];
    my_CTX ctx;
    int ii;

    lcb_create(&ctx.instance, NULL);
    lcb_connect(ctx.instance);
    lcb_wait(ctx.instance);
    pthread_mutex_init(&ctx.mutex, NULL);

    for (ii = 0; ii < 10; ii++) {
        pthread_create(&thrs[ii], NULL, thrfunc_locked, &ctx);
    }

    for (ii = 0; ii < 10; ii++) {
        void *ign;
        pthread_join(thrs[ii], &ign);
    }

    lcb_destroy(ctx.instance);
    pthread_mutex_destroy(&ctx.mutex);

    for (ii = 0; ii < 10; ii++) {
        pthread_create(&thrs[ii], NULL, thrfunc_unlocked, NULL);
    }
    for (ii = 0; ii < 10; ii++) {
        void *ign;
        pthread_join(thrs[ii], &ign);
    }
    return 0;
}
