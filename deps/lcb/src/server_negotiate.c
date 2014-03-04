#include "packetutils.h"
#include "simplestring.h"
#include "lcbio.h"
#include "mcserver.h"
#include "logging.h"
#include "settings.h"

#define LOGARGS(ctx, lvl) \
    ctx->settings, "negotiation", LCB_LOG_##lvl, __FILE__, __LINE__

#define LOG(ctx, lvl, msg) lcb_log(LOGARGS(ctx, lvl), msg)

static void io_error_handler(lcb_connection_t);
static void io_read_handler(lcb_connection_t);

static int sasl_get_username(void *context,
                             int id,
                             const char **result,
                             unsigned int *len)
{
    struct negotiation_context *ctx = context;
    if (!context || !result || (id != CBSASL_CB_USER && id != CBSASL_CB_AUTHNAME)) {
        return SASL_BADPARAM;
    }

    *result = ctx->settings->username;
    if (len) {
        *len = (unsigned int)strlen(*result);
    }

    return SASL_OK;
}

static int sasl_get_password(cbsasl_conn_t *conn,
                             void *context,
                             int id,
                             cbsasl_secret_t **psecret)
{
    struct negotiation_context *ctx = context;
    if (!conn || ! psecret || id != CBSASL_CB_PASS || ctx == NULL) {
        return SASL_BADPARAM;
    }

    *psecret = &ctx->u_auth.secret;
    return SASL_OK;
}

static lcb_error_t setup_sasl_params(struct negotiation_context *ctx)
{
    int ii;
    cbsasl_callback_t *callbacks = ctx->sasl_callbacks;
    const char *password = ctx->settings->password;

    callbacks[0].id = CBSASL_CB_USER;
    callbacks[0].proc = (int( *)(void)) &sasl_get_username;

    callbacks[1].id = CBSASL_CB_AUTHNAME;
    callbacks[1].proc = (int( *)(void)) &sasl_get_username;

    callbacks[2].id = CBSASL_CB_PASS;
    callbacks[2].proc = (int( *)(void)) &sasl_get_password;

    callbacks[3].id = CBSASL_CB_LIST_END;
    callbacks[3].proc = NULL;
    callbacks[3].context = NULL;

    for (ii = 0; ii < 3; ii++) {
        callbacks[ii].context = ctx;
    }

    memset(&ctx->u_auth, 0, sizeof(ctx->u_auth));

    if (password) {
        unsigned long pwlen;
        lcb_size_t maxlen;

        pwlen = (unsigned long)strlen(password);
        maxlen = sizeof(ctx->u_auth.buffer) - offsetof(cbsasl_secret_t, data);
        ctx->u_auth.secret.len = pwlen;

        if (pwlen < maxlen) {
            memcpy(ctx->u_auth.secret.data, password, pwlen);
        } else {
            return LCB_EINVAL;
        }
    }


    return LCB_SUCCESS;
}

static void negotiation_cleanup(struct negotiation_context *ctx)
{
    lcb_connection_t conn = ctx->conn;
    lcb_sockrw_set_want(conn, 0, 1);
    lcb_sockrw_apply_want(conn);
    memset(&conn->easy, 0, sizeof(conn->easy));
    conn->evinfo.handler = NULL;
    conn->completion.error = NULL;
    conn->completion.read = NULL;
    conn->completion.write = NULL;
    if (ctx->timer) {
        lcb_timer_destroy(NULL, ctx->timer);
        ctx->timer = NULL;
    }
}

static void negotiation_success(struct negotiation_context *ctx)
{
    negotiation_cleanup(ctx);
    ctx->done_ = 1;
    ctx->complete(ctx, LCB_SUCCESS);
}

static void negotiation_set_error_ex(struct negotiation_context *ctx,
                                     lcb_error_t err,
                                     const char *msg)
{
    ctx->errinfo.err = err;
    if (msg) {
        if (ctx->errinfo.msg) {
            free(ctx->errinfo.msg);
        }
        ctx->errinfo.msg = strdup(msg);
    }
    (void)msg;
}

static void negotiation_set_error(struct negotiation_context *ctx,
                                  const char *msg)
{
    negotiation_set_error_ex(ctx, LCB_AUTH_ERROR, msg);
}


static void negotiation_bail(struct negotiation_context *ctx)
{
    negotiation_cleanup(ctx);
    ctx->complete(ctx, ctx->errinfo.err);
}



static void timeout_handler(lcb_timer_t tm, lcb_t i, const void *cookie)
{
    struct negotiation_context *ctx = (struct negotiation_context *)cookie;
    negotiation_set_error_ex(ctx, LCB_ETIMEDOUT, "Negotiation timed out");
    (void)tm;
    (void)i;
}

/**
 * Called to retrive the mechlist from the packet.
 */
static int set_chosen_mech(struct negotiation_context *ctx,
                           lcb_string *mechlist,
                           const char **data,
                           unsigned int *ndata)
{
    cbsasl_error_t saslerr;
    const char *chosenmech;

    if (ctx->settings->sasl_mech_force) {
        char *forcemech = ctx->settings->sasl_mech_force;
        if (!strstr(mechlist->base, forcemech)) {
            /** Requested mechanism not found */
            negotiation_set_error_ex(ctx,
                                     LCB_SASLMECH_UNAVAILABLE,
                                     mechlist->base);
            return -1;
        }

        lcb_string_clear(mechlist);
        if (lcb_string_appendz(mechlist, forcemech)) {
            negotiation_set_error_ex(ctx, LCB_CLIENT_ENOMEM, NULL);
            return -1;
        }
    }

    saslerr = cbsasl_client_start(ctx->sasl, mechlist->base,
                                  NULL, data, ndata, &chosenmech);
    if (saslerr != SASL_OK) {
        negotiation_set_error(ctx, "Couldn't start SASL client");
        return -1;
    }

    ctx->nmech = strlen(chosenmech);
    if (! (ctx->mech = strdup(chosenmech)) ) {
        negotiation_set_error_ex(ctx, LCB_CLIENT_ENOMEM, NULL);
        return -1;
    }

    return 0;
}

/**
 * Given the specific mechanisms, send the auth packet to the server.
 */
static int send_sasl_auth(struct negotiation_context *ctx,
                          const char *sasl_data,
                          unsigned int ndata)
{
    protocol_binary_request_no_extras req;
    protocol_binary_request_header *hdr = &req.message.header;
    lcb_connection_t conn = ctx->conn;
    lcb_size_t to_write;

    memset(&req, 0, sizeof(req));

    hdr->request.magic = PROTOCOL_BINARY_REQ;
    hdr->request.opcode = PROTOCOL_BINARY_CMD_SASL_AUTH;
    hdr->request.keylen = htons((lcb_uint16_t)ctx->nmech);
    hdr->request.datatype = PROTOCOL_BINARY_RAW_BYTES;
    hdr->request.bodylen = htonl((lcb_uint32_t)ndata + ctx->nmech);

    /** Write the packet */
    if (!conn->output) {
        if (! (conn->output = calloc(1, sizeof(*conn->output)))) {
            negotiation_set_error_ex(ctx, LCB_CLIENT_ENOMEM, NULL);
            return -1;
        }
    }

    to_write = sizeof(req.bytes) + ctx->nmech + ndata;

    if (!ringbuffer_ensure_capacity(conn->output, to_write)) {
        negotiation_set_error_ex(ctx, LCB_CLIENT_ENOMEM, NULL);
        return -1;
    }

    ringbuffer_write(conn->output, req.bytes, sizeof(req.bytes));
    ringbuffer_write(conn->output, ctx->mech, ctx->nmech);
    ringbuffer_write(conn->output, sasl_data, ndata);
    lcb_sockrw_set_want(conn, LCB_WRITE_EVENT, 0);
    return 0;
}

static int send_sasl_step(struct negotiation_context *ctx,
                          packet_info *packet)
{
    protocol_binary_request_no_extras req;
    protocol_binary_request_header *hdr = &req.message.header;
    lcb_connection_t conn = ctx->conn;
    cbsasl_error_t saslerr;
    const char *step_data;
    unsigned int ndata;
    lcb_size_t to_write;

    saslerr = cbsasl_client_step(ctx->sasl,
                                 packet->payload,
                                 PACKET_NBODY(packet),
                                 NULL,
                                 &step_data,
                                 &ndata);

    if (saslerr != SASL_CONTINUE) {
        negotiation_set_error(ctx, "Unable to perform SASL STEP");
        return -1;
    }


    memset(&req, 0, sizeof(req));
    hdr->request.magic = PROTOCOL_BINARY_REQ;
    hdr->request.opcode = PROTOCOL_BINARY_CMD_SASL_STEP;
    hdr->request.keylen = htons((lcb_uint16_t)ctx->nmech);
    hdr->request.bodylen = htonl((lcb_uint32_t)ndata + ctx->nmech);
    hdr->request.datatype = PROTOCOL_BINARY_RAW_BYTES;

    to_write = sizeof(req) + ctx->nmech + ndata;
    if (!conn->output) {
        if ( (conn->output = calloc(1, sizeof(*conn->output))) == NULL) {
            negotiation_set_error_ex(ctx, LCB_CLIENT_ENOMEM, NULL);
            return -1;
        }
    }

    if (!ringbuffer_ensure_capacity(conn->output, to_write)) {
        negotiation_set_error_ex(ctx, LCB_CLIENT_ENOMEM, NULL);
        return -1;
    }

    ringbuffer_write(conn->output, req.bytes, sizeof(req.bytes));
    ringbuffer_write(conn->output, ctx->mech, ctx->nmech);
    ringbuffer_write(conn->output, step_data, ndata);
    lcb_sockrw_set_want(conn, LCB_WRITE_EVENT, 0);
    return 0;
}

/**
 * It's assumed the server buffers will be reset upon close(), so we must make
 * sure to _not_ release the ringbuffer if that happens.
 */
static void io_read_handler(lcb_connection_t conn)
{
    packet_info info;
    int rv;
    int is_done = 0;
    lcb_uint16_t status;
    struct negotiation_context *ctx = conn->data;
    memset(&info, 0, sizeof(info));


    rv = lcb_packet_read_ringbuffer(&info, conn->input);
    if (rv == 0) {
        lcb_sockrw_set_want(conn, LCB_READ_EVENT, 1);
        lcb_sockrw_apply_want(conn);
        return;
    }

    if (rv == -1) {
        negotiation_set_error_ex(ctx, LCB_CLIENT_ENOMEM, NULL);
        LOG(ctx, ERR, "Packet parse error");
        return;
    }

    status = PACKET_STATUS(&info);

    switch (PACKET_OPCODE(&info)) {
    case PROTOCOL_BINARY_CMD_SASL_LIST_MECHS: {
        lcb_string str;
        const char *mechlist_data;
        unsigned int nmechlist_data;

        if (lcb_string_init(&str)) {
            negotiation_set_error_ex(ctx, LCB_CLIENT_ENOMEM, NULL);
            rv = -1;
            break;
        }

        if (lcb_string_append(&str, info.payload, PACKET_NBODY(&info))) {
            lcb_string_release(&str);
            negotiation_set_error_ex(ctx, LCB_CLIENT_ENOMEM, NULL);
        }

        rv = set_chosen_mech(ctx, &str, &mechlist_data, &nmechlist_data);
        if (rv == 0) {
            rv = send_sasl_auth(ctx, mechlist_data, nmechlist_data);
        }

        lcb_string_release(&str);
        break;
    }

    case PROTOCOL_BINARY_CMD_SASL_AUTH: {
        if (status == PROTOCOL_BINARY_RESPONSE_SUCCESS) {
            rv = 0;
            is_done = 1;
            break;
        }

        if (status != PROTOCOL_BINARY_RESPONSE_AUTH_CONTINUE) {
            negotiation_set_error(ctx, "SASL AUTH failed");
            rv = -1;
            break;
        }
        rv = send_sasl_step(ctx, &info);
        break;
    }

    case PROTOCOL_BINARY_CMD_SASL_STEP: {
        if (status != PROTOCOL_BINARY_RESPONSE_SUCCESS) {
            negotiation_set_error(ctx, "SASL Step Failed");
            rv = -1;
        } else {
            rv = 0;
            is_done = 1;
        }
        break;
    }

    default: {
        rv = -1;
        negotiation_set_error_ex(ctx, LCB_NOT_SUPPORTED,
                             "Received unknown response");
        break;
    }
    }

    lcb_packet_release_ringbuffer(&info, conn->input);

    if (ctx->errinfo.err) {
        negotiation_bail(ctx);
        return;
    }

    if (is_done) {
        negotiation_success(ctx);
    } else if (rv == 0) {
        lcb_sockrw_apply_want(conn);
    }
}

static void io_error_handler(lcb_connection_t conn)
{
    struct negotiation_context *ctx = conn->data;
    negotiation_set_error_ex(ctx, LCB_NETWORK_ERROR, "IO Error");
    negotiation_bail(ctx);
}

struct negotiation_context* lcb_negotiation_create(lcb_connection_t conn,
                                                   lcb_settings *settings,
                                                   lcb_uint32_t timeout,
                                                   const char *remote,
                                                   const char *local,
                                                   lcb_error_t *err)
{
    cbsasl_error_t saslerr;
    protocol_binary_request_no_extras req;
    struct negotiation_context *ctx = calloc(1, sizeof(*ctx));
    struct lcb_io_use_st use;
    const lcb_host_t *curhost;

    if (ctx == NULL) {
        *err = LCB_CLIENT_ENOMEM;
        return NULL;
    }

    conn->data = ctx;
    ctx->settings = settings;
    ctx->conn = conn;
    curhost = lcb_connection_get_host(conn);

    *err = setup_sasl_params(ctx);

    if (*err != LCB_SUCCESS) {
        lcb_negotiation_destroy(ctx);
        return NULL;
    }

    saslerr = cbsasl_client_new("couchbase", curhost->host,
                                local, remote,
                                ctx->sasl_callbacks, 0,
                                &ctx->sasl);

    if (saslerr != SASL_OK) {
        lcb_negotiation_destroy(ctx);
        *err = LCB_CLIENT_ENOMEM;
        return NULL;
    }

    if (timeout) {
        ctx->timer = lcb_timer_create_simple(conn->io,
                                             ctx, timeout, timeout_handler);
    }

    memset(&req, 0, sizeof(req));
    req.message.header.request.magic = PROTOCOL_BINARY_REQ;
    req.message.header.request.opcode = PROTOCOL_BINARY_CMD_SASL_LIST_MECHS;
    req.message.header.request.datatype = PROTOCOL_BINARY_RAW_BYTES;
    req.message.header.request.bodylen = 0;
    req.message.header.request.keylen = 0;
    req.message.header.request.opaque = 0;

    if ( (*err = lcb_connection_reset_buffers(conn)) != LCB_SUCCESS) {
        lcb_negotiation_destroy(ctx);
        return NULL;
    }

    if (!conn->output) {
        if ((conn->output = calloc(1, sizeof(*conn->output))) == NULL) {
            *err = LCB_CLIENT_ENOMEM;
            lcb_negotiation_destroy(ctx);
            return NULL;
        }
    } else {
        lcb_assert(conn->output->nbytes == 0);
    }

    if (!ringbuffer_ensure_capacity(conn->output, sizeof(req.bytes))) {
        *err = LCB_CLIENT_ENOMEM;
        lcb_negotiation_destroy(ctx);
        return NULL;
    }

    if (ringbuffer_write(conn->output, req.bytes, sizeof(req.bytes)) != sizeof(req.bytes)) {
        *err = LCB_EINTERNAL;
        lcb_negotiation_destroy(ctx);
        return NULL;
    }

    /** Set up the I/O handlers */
    lcb_connuse_easy(&use, ctx, io_read_handler, io_error_handler);
    lcb_connection_use(conn, &use);
    lcb_sockrw_set_want(conn, LCB_WRITE_EVENT, 1);
    lcb_sockrw_apply_want(conn);
    *err = LCB_SUCCESS;
    return ctx;
}


void lcb_negotiation_destroy(struct negotiation_context *ctx)
{

    if (ctx->sasl) {
        cbsasl_dispose(&ctx->sasl);
    }

    if (ctx->mech) {
        free(ctx->mech);
    }

    if (ctx->timer) {
        lcb_timer_destroy(NULL, ctx->timer);
    }

    free(ctx->errinfo.msg);
    free(ctx);
}
