#include "internal.h"
#include "hostlist.h"
#include "connmgr.h"

#define LOGARGS(mgr, lvl) \
    mgr->settings, "connmgr", LCB_LOG_##lvl, __FILE__, __LINE__

typedef enum {
    CS_PENDING,
    CS_IDLE,
    CS_LEASED
} cinfo_state;

typedef enum {
    RS_UNINIT = 0,
    RS_PENDING,
    RS_ASSIGNED
} request_state;

typedef struct connmgr_cinfo_st {
    lcb_list_t llnode;
    struct connmgr_hostent_st *parent;
    struct lcb_connection_st connection;
    lcb_timer_t idle_timer;
    int state;
} connmgr_cinfo;

#define HE_NPEND(he) LCB_CLIST_SIZE(&(he)->ll_pending)
#define HE_NIDLE(he) LCB_CLIST_SIZE(&(he)->ll_idle)
#define HE_NREQS(he) LCB_CLIST_SIZE(&(he)->requests)

static void on_idle_timeout(lcb_timer_t tm, lcb_t instance, const void *cookie);
static void he_available_notify(lcb_timer_t tm, lcb_t i, const void *cookie);
static void he_dump(connmgr_hostent *he, FILE *out);

static void destroy_cinfo(connmgr_cinfo *info)
{
    info->parent->n_total--;

    if (info->state == CS_IDLE) {
        lcb_clist_delete(&info->parent->ll_idle, &info->llnode);
    }

    lcb_timer_destroy(NULL, info->idle_timer);
    lcb_connection_cleanup(&info->connection);

    free(info);
}

static connmgr_hostent * he_from_conn(connmgr_t *mgr, lcb_connection_t conn)
{
    connmgr_cinfo *ci = conn->poolinfo;
    (void)mgr;

    lcb_assert(ci);
    return ci->parent;
}

connmgr_t *connmgr_create(lcb_settings *settings, lcb_io_opt_t io)
{
    connmgr_t *pool = calloc(1, sizeof(*pool));
    if (!pool) {
        return NULL;
    }

    if ((pool->ht = lcb_hashtable_nc_new(32)) == NULL) {
        free(pool);
        return NULL;
    }

    pool->settings = settings;
    pool->io = io;
    return pool;
}

static void iterfunc(const void *k,
                     lcb_size_t nk,
                     const void *v,
                     lcb_size_t nv,
                     void *arg)
{
    lcb_clist_t *he_list = (lcb_clist_t *)arg;
    connmgr_hostent *he = (connmgr_hostent *)v;
    lcb_list_t *cur, *next;

    LCB_LIST_SAFE_FOR(cur, next, (lcb_list_t *)&he->ll_idle) {
        connmgr_cinfo *info = LCB_LIST_ITEM(cur, connmgr_cinfo, llnode);
        destroy_cinfo(info);
    }
    LCB_LIST_SAFE_FOR(cur, next, (lcb_list_t *)&he->ll_pending) {
        connmgr_cinfo *info = LCB_LIST_ITEM(cur, connmgr_cinfo, llnode);
        destroy_cinfo(info);
    }

    lcb_clist_init(&he->ll_idle);
    lcb_clist_append(he_list, (lcb_list_t *)&he->ll_idle);

    (void)k;
    (void)nk;
    (void)nv;
}

void connmgr_destroy(connmgr_t *mgr)
{
    lcb_clist_t hes;
    lcb_list_t *cur, *next;
    lcb_clist_init(&hes);

    genhash_iter(mgr->ht, iterfunc, &hes);

    LCB_LIST_SAFE_FOR(cur, next, (lcb_list_t*)&hes) {
        connmgr_hostent *he = LCB_LIST_ITEM(cur, connmgr_hostent, ll_idle);
        genhash_delete(mgr->ht, he->key, strlen(he->key));
        lcb_clist_delete(&hes, (lcb_list_t *)&he->ll_idle);
        lcb_async_destroy(NULL, he->async);
        free(he);
    }

    genhash_free(mgr->ht);
    free(mgr);
}

static void invoke_request(connmgr_request *req)
{
    if (req->conn) {
        connmgr_cinfo *info = (connmgr_cinfo *)req->conn->poolinfo;
        lcb_assert(info->state == CS_IDLE);
        info->state = CS_LEASED;
        req->state = RS_ASSIGNED;
        lcb_timer_disarm(info->idle_timer);
    }

    if (req->timer) {
        lcb_timer_destroy(NULL, req->timer);
        req->timer = NULL;
    }

    req->callback(req);
}

/**
 * Called to notify that a connection has become available.
 */
static void connection_available(connmgr_hostent *he)
{
    while (LCB_CLIST_SIZE(&he->requests) && LCB_CLIST_SIZE(&he->ll_idle)) {
        connmgr_request *req;
        connmgr_cinfo *info;
        lcb_list_t *reqitem, *connitem;

        reqitem = lcb_clist_shift(&he->requests);
        connitem = lcb_clist_pop(&he->ll_idle);

        req = LCB_LIST_ITEM(reqitem, connmgr_request, llnode);
        info = LCB_LIST_ITEM(connitem, connmgr_cinfo, llnode);

        req->conn = &info->connection;
        he->n_leased++;

        lcb_log(LOGARGS(he->parent, INFO),
                "Assigning R=%p,c=%p", req, req->conn);

        invoke_request(req);
    }
}

static void on_connected(lcb_connection_t conn, lcb_error_t err)
{
    connmgr_cinfo *info = (connmgr_cinfo *)conn->poolinfo;
    connmgr_hostent *he = info->parent;
    lcb_assert(info->state == CS_PENDING);

    lcb_log(LOGARGS(he->parent, INFO),
            "Received result for I=%p,C=%p; E=0x%x", info, conn, err);

    lcb_clist_delete(&he->ll_pending, &info->llnode);

    if (err != LCB_SUCCESS) {
        /** If the connection failed, fail out all remaining requests */
        lcb_list_t *cur, *next;
        LCB_LIST_SAFE_FOR(cur, next, (lcb_list_t *)&he->requests) {
            connmgr_request *req = LCB_LIST_ITEM(cur, connmgr_request, llnode);
            lcb_clist_delete(&he->requests, &req->llnode);
            req->conn = NULL;
            invoke_request(req);
        }

        destroy_cinfo(info);

    } else {
        info->state = CS_IDLE;
        lcb_clist_append(&he->ll_idle, &info->llnode);
        lcb_timer_rearm(info->idle_timer, he->parent->idle_timeout);
        connection_available(info->parent);
    }
}

static void start_new_connection(connmgr_hostent *he, lcb_uint32_t tmo)
{
    lcb_host_t tmphost;
    lcb_error_t err;
    lcb_conn_params params;

    connmgr_cinfo *info = calloc(1, sizeof(*info));
    info->state = CS_PENDING;
    info->parent = he;
    info->connection.poolinfo = info;
    info->idle_timer = lcb_timer_create_simple(he->parent->io, info, 0,
                                               on_idle_timeout);
    lcb_timer_disarm(info->idle_timer);

    lcb_connection_init(&info->connection,
                        he->parent->io,
                        he->parent->settings);

    params.handler = on_connected;
    params.timeout = tmo;
    err = lcb_host_parsez(&tmphost, he->key, 80);
    lcb_assert(err == LCB_SUCCESS);
    params.destination = &tmphost;
    lcb_log(LOGARGS(he->parent, INFO),
            "Starting connection on I=%p,C=%p", info, &info->connection);
    lcb_connection_start(&info->connection, &params,
                         LCB_CONNSTART_ASYNCERR|LCB_CONNSTART_NOCB);
    lcb_clist_append(&he->ll_pending, &info->llnode);
    he->n_total++;
}

static void on_request_timeout(lcb_timer_t tm, lcb_t instance,
                               const void *cookie)
{
    connmgr_request *req = (connmgr_request *)cookie;
    lcb_clist_delete(&req->he->requests, &req->llnode);
    invoke_request(req);

    (void)tm;
    (void)instance;
}

static void async_invoke_request(lcb_timer_t tm, lcb_t instance, const void *cookie)
{

    connmgr_request *req = (connmgr_request *)cookie;
    connmgr_cinfo *cinfo = (connmgr_cinfo *)req->conn->poolinfo;
    cinfo->state = CS_IDLE;
    invoke_request(req);
    (void)tm;
    (void)instance;
}

void connmgr_get(connmgr_t *pool, connmgr_request *req, lcb_uint32_t timeout)
{
    connmgr_hostent *he;
    lcb_list_t *cur;

    if (req->state != RS_UNINIT) {
        lcb_log(LOGARGS(pool, INFO),
                "Request %p/%s already in progress..", req, req->key);
        return;
    }

    lcb_log(LOGARGS(pool, DEBUG), "Got request R=%p,%s", req, req->key);

    he = genhash_find(pool->ht, req->key, strlen(req->key));
    if (!he) {
        lcb_error_t dummy;
        he = calloc(1, sizeof(*he));
        he->parent = pool;
        he->async = lcb_async_create(pool->io, he, he_available_notify, &dummy);
        lcb_async_cancel(he->async);
        strcpy(he->key, req->key);

        lcb_clist_init(&he->ll_idle);
        lcb_clist_init(&he->ll_pending);
        lcb_clist_init(&he->requests);

        /** Not copied */
        genhash_store(pool->ht, he->key, strlen(he->key), he, 0);
    }

    req->he = he;
    cur = lcb_clist_pop(&he->ll_idle);

    if (cur) {
        connmgr_cinfo *info = LCB_LIST_ITEM(cur, connmgr_cinfo, llnode);
        lcb_error_t err;

        lcb_timer_disarm(info->idle_timer);

        req->conn = &info->connection;
        req->state = RS_ASSIGNED;
        req->timer = lcb_async_create(pool->io, req, async_invoke_request, &err);

        info->state = CS_LEASED;
        he->n_leased++;

    } else {
        req->state = RS_PENDING;
        req->timer = lcb_timer_create_simple(pool->io,
                                             req,
                                             timeout,
                                             on_request_timeout);

        lcb_clist_append(&he->requests, &req->llnode);
        if (HE_NPEND(he) < HE_NREQS(he)) {
            start_new_connection(he, timeout);

        } else {
            lcb_log(LOGARGS(pool, INFO),
                    "Not creating a new connection. There are still pending ones");
        }
    }
}

/**
 * Invoked when a new socket is available for allocation within the
 * request queue.
 */
static void he_available_notify(lcb_timer_t t, lcb_t i, const void *cookie)
{
    connection_available((connmgr_hostent *)cookie);
    (void)t; (void)i;
}

void connmgr_cancel(connmgr_t *mgr, connmgr_request *req)
{
    connmgr_hostent *he = req->he;
    if (req->state == RS_UNINIT) {
        lcb_log(LOGARGS(mgr, DEBUG), "Not cancelling uninit request");
        return;
    }

    if (req->timer) {
        lcb_timer_destroy(NULL, req->timer);
        req->timer = NULL;
    }

    if (req->conn) {
        lcb_log(LOGARGS(mgr, DEBUG), "Cancelling request with existing connection");
        connmgr_put(mgr, req->conn);
        lcb_async_signal(he->async);

    } else {
        lcb_log(LOGARGS(mgr, DEBUG), "Request has no connection.. yet");
        lcb_clist_delete(&he->requests, &req->llnode);
    }
}

static void io_error(lcb_connection_t conn)
{
    connmgr_cinfo *info = conn->poolinfo;
    lcb_assert(info);
    lcb_assert(info->state != CS_LEASED);

    if (info->state == CS_IDLE) {
        lcb_log(LOGARGS(info->parent->parent, INFO),
                "Pooled idle connection %p expired", conn);
    }

    destroy_cinfo(info);
}

static void io_read(lcb_connection_t conn)
{
    io_error(conn);
}


static void on_idle_timeout(lcb_timer_t tm, lcb_t instance, const void *cookie)
{
    connmgr_cinfo *info = (connmgr_cinfo *)cookie;

    lcb_log(LOGARGS(info->parent->parent, DEBUG),
            "Idle connection %p to %s expired",
            &info->connection, info->parent->key);

    io_error(&info->connection);
    (void)tm;
    (void)instance;
}


void connmgr_put(connmgr_t *mgr, lcb_connection_t conn)
{
    struct lcb_io_use_st use;
    connmgr_hostent *he;
    connmgr_cinfo *info = conn->poolinfo;

    lcb_assert(conn->state == LCB_CONNSTATE_CONNECTED);
    lcb_assert(conn->poolinfo != NULL);

    he = he_from_conn(mgr, conn);
    if (HE_NIDLE(he) >= mgr->max_idle &&
            HE_NREQS(he) <= (he->n_leased - he->n_leased)) {

        lcb_log(LOGARGS(mgr, INFO),
                "Closing idle connection. Too many in quota");
        connmgr_discard(mgr, conn);
        return;
    }

    lcb_log(LOGARGS(mgr, INFO),
            "Reclaiming connection I=%p,Cu=%p,Cp=%p (%s)",
            info, conn, &info->connection, he->key);

    he->n_leased--;
    lcb_connuse_easy(&use, info, io_read, io_error);
    lcb_connection_transfer_socket(conn, &info->connection, &use);
    lcb_sockrw_set_want(&info->connection, 0, 1);
    lcb_sockrw_apply_want(&info->connection);
    lcb_timer_rearm(info->idle_timer, mgr->idle_timeout);
    lcb_clist_append(&he->ll_idle, &info->llnode);
    info->state = CS_IDLE;
}

void connmgr_discard(connmgr_t *pool, lcb_connection_t conn)
{
    connmgr_cinfo *cinfo = conn->poolinfo;

    lcb_log(LOGARGS(pool, DEBUG), "Discarding connection %p", conn);
    lcb_assert(cinfo);
    lcb_connection_cleanup(conn);
    cinfo->parent->n_leased--;
    destroy_cinfo(cinfo);
}

LCB_INTERNAL_API
void connmgr_req_init(connmgr_request *req, const char *host, const char *port,
                      connmgr_callback_t callback)
{
    memset(req, 0, sizeof(*req));
    req->callback = callback;
    sprintf(req->key, "%s:%s", host, port);
}

#define CONN_INDENT "    "

static void write_he_list(lcb_clist_t *ll, FILE *out)
{
    lcb_list_t *llcur;
    LCB_LIST_FOR(llcur, (lcb_list_t *)ll) {
        connmgr_cinfo *info = LCB_LIST_ITEM(llcur, connmgr_cinfo, llnode);
        fprintf(out, "%sCONN [I=%p,C=%p ",
                CONN_INDENT,
                (void *)info,
                (void *)&info->connection);

        if (info->connection.io->version == 0) {
            fprintf(out, "SOCKFD=%d", (int)info->connection.sockfd);
        } else {
            fprintf(out, "SOCKDATA=%p", (void *)info->connection.sockptr);
        }
        fprintf(out, " STATE=0x%x", info->state);
        fprintf(out, "]\n");
    }

}

static void he_dump(connmgr_hostent *he, FILE *out)
{
    lcb_list_t *llcur;
    fprintf(out, "HOST=%s", he->key);
    fprintf(out, "Requests=%d, Idle=%d, Pending=%d, Leased=%d\n",
            (int)HE_NREQS(he),
            (int)HE_NIDLE(he),
            (int)HE_NPEND(he),
            he->n_leased);

    fprintf(out, CONN_INDENT "Idle Connections:\n");
    write_he_list(&he->ll_idle, out);
    fprintf(out, CONN_INDENT "Pending Connections: \n");
    write_he_list(&he->ll_pending, out);
    fprintf(out, CONN_INDENT "Pending Requests:\n");

    LCB_LIST_FOR(llcur, (lcb_list_t *)&he->requests) {
        connmgr_request *req = LCB_LIST_ITEM(llcur, connmgr_request, llnode);
        union {
            connmgr_callback_t cb;
            void *ptr;
        } u_cb;

        u_cb.cb = req->callback;

        fprintf(out, "%sREQ [R=%p, Callback=%p, Data=%p, State=0x%x]\n",
                CONN_INDENT,
                (void *)req,
                u_cb.ptr,
                (void *)req->data,
                req->state);
    }

    fprintf(out, "\n");

}

static void dumpfunc(const void *k, lcb_size_t nk, const void *v, lcb_size_t nv,
                     void *arg)
{
    FILE *out = (FILE *)arg;
    connmgr_hostent *he = (connmgr_hostent *)v;
    he_dump(he, out);
    (void)nk;(void)k;(void)nv;
}

/**
 * Dumps the connection manager state to stderr
 */
LCB_INTERNAL_API
void connmgr_dump(connmgr_t *mgr, FILE *out)
{
    if (out == NULL) {
        out = stderr;
    }

    genhash_iter(mgr->ht, dumpfunc, out);
}
