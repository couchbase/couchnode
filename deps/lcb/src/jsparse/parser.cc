/*
 *     Copyright 2013-2015 Couchbase, Inc.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */
#if defined(__GNUC__)
#define JSONSL_API static __attribute__((unused))
#elif defined(_MSC_VER)
#define JSONSL_API static __inline
#else
#define JSONSL_API static
#endif
#include "contrib/jsonsl/jsonsl.c"
#include "contrib/lcb-jsoncpp/lcb-jsoncpp.h"
#include "parser.h"
#include <assert.h>

#define DECLARE_JSONSL_CALLBACK(name) \
static void name(jsonsl_t,jsonsl_action_t,struct jsonsl_state_st*,const char*)


DECLARE_JSONSL_CALLBACK(row_pop_callback);
DECLARE_JSONSL_CALLBACK(initial_push_callback);
DECLARE_JSONSL_CALLBACK(initial_pop_callback);
DECLARE_JSONSL_CALLBACK(meta_header_complete_callback);
DECLARE_JSONSL_CALLBACK(trailer_pop_callback);

/* conform to void */
#define JOBJ_RESPONSE_ROOT (void*)1
#define JOBJ_ROWSET (void*)2

#define NORMALIZE_OFFSETS(buf, len) buf++; len--;

#define buffer_append lcb_string_append

/**
 * Gets a buffer, given an (absolute) position offset.
 * It will try to get a buffer of size desired. The actual size is
 * returned in 'actual' (and may be less than desired, maybe even 0)
 */
static const char *
get_buffer_region(lcbjsp_PARSER *ctx, size_t pos, size_t desired, size_t *actual)
{
    const char *ret = ctx->current_buf.base + pos - ctx->min_pos;
    const char *end = ctx->current_buf.base + ctx->current_buf.nused;
    *actual = end - ret;

    if (ctx->min_pos > pos) {
        /* swallowed */
        *actual = 0;
        return NULL;
    }

    assert(ret < end);
    if (desired < *actual) {
        *actual = desired;
    }
    return ret;
}

/**
 * Consolidate the meta data into a single parsable string..
 */
static void
combine_meta(lcbjsp_PARSER *ctx)
{
    const char *meta_trailer;
    size_t ntrailer;

    if (ctx->meta_complete) {
        return;
    }

    assert(ctx->header_len <= ctx->meta_buf.nused);

    /* Adjust the length for the first portion */
    ctx->meta_buf.nused = ctx->header_len;

    /* Append any trailing data */
    meta_trailer = get_buffer_region(ctx, ctx->last_row_endpos, -1, &ntrailer);

    buffer_append(&ctx->meta_buf, meta_trailer, ntrailer);
    ctx->meta_complete = 1;
}

static lcbjsp_PARSER *
get_ctx(jsonsl_t jsn)
{
    return reinterpret_cast<lcbjsp_PARSER*>(jsn->data);
}

static void
meta_header_complete_callback(jsonsl_t jsn, jsonsl_action_t action,
    struct jsonsl_state_st *state, const jsonsl_char_t *at)
{

    lcbjsp_PARSER *ctx = get_ctx(jsn);
    buffer_append(&ctx->meta_buf, ctx->current_buf.base, state->pos_begin);

    ctx->header_len = state->pos_begin;
    jsn->action_callback_PUSH = NULL;

    (void)action; (void)at;
}


static void
row_pop_callback(jsonsl_t jsn, jsonsl_action_t action,
    struct jsonsl_state_st *state, const jsonsl_char_t *at)
{
    lcbjsp_ROW dt = { LCBJSP_TYPE_ROW };
    lcbjsp_PARSER *ctx = get_ctx(jsn);
    const char *rowbuf;
    size_t szdummy;

    if (ctx->have_error) {
        return;
    }

    ctx->keep_pos = jsn->pos;
    ctx->last_row_endpos = jsn->pos;

    if (state->data == JOBJ_ROWSET) {
        /** The closing ] of "rows" : [ ... ] */
        jsn->action_callback_POP = trailer_pop_callback;
        jsn->action_callback_PUSH = NULL;
        if (ctx->rowcount == 0) {
            /* Emulate what meta_header_complete callback does. */

            /* While the entire meta is available to us, the _closing_ part
             * of the meta is handled in a different callback. */
            buffer_append(&ctx->meta_buf, ctx->current_buf.base, jsn->pos);
            ctx->header_len = jsn->pos;
        }
        return;
    }

    ctx->rowcount++;

    if (!ctx->callback) {
        return;
    }

    rowbuf = get_buffer_region(ctx, state->pos_begin, -1, &szdummy);
    dt.type = LCBJSP_TYPE_ROW;
    dt.row.iov_base = (void *)rowbuf;
    dt.row.iov_len = jsn->pos - state->pos_begin + 1;
    ctx->callback(ctx, &dt);

    (void)action; (void)at;
}

static int
parse_error_callback(jsonsl_t jsn, jsonsl_error_t error,
    struct jsonsl_state_st *state, jsonsl_char_t *at)
{
    lcbjsp_PARSER *ctx = get_ctx(jsn);
    lcbjsp_ROW dt;

    ctx->have_error = 1;

    /* invoke the callback */
    dt.type = LCBJSP_TYPE_ERROR;
    dt.row.iov_base = ctx->current_buf.base;
    dt.row.iov_len = ctx->current_buf.nused;
    ctx->callback(ctx, &dt);

    (void)error; (void)state; (void)at;

    return 0;
}

static void
trailer_pop_callback(jsonsl_t jsn, jsonsl_action_t action,
    struct jsonsl_state_st *state, const jsonsl_char_t *at)
{
    lcbjsp_PARSER *ctx = get_ctx(jsn);
    lcbjsp_ROW dt;
    if (state->data != JOBJ_RESPONSE_ROOT) {
        return;
    }
    combine_meta(ctx);
    dt.row.iov_base = ctx->meta_buf.base;
    dt.row.iov_len = ctx->meta_buf.nused;
    dt.type = LCBJSP_TYPE_COMPLETE;
    ctx->callback(ctx, &dt);

    (void)action; (void)at;
}

static void
initial_pop_callback(jsonsl_t jsn, jsonsl_action_t action,
    struct jsonsl_state_st *state, const jsonsl_char_t *at)
{
    lcbjsp_PARSER *ctx = get_ctx(jsn);
    char *key;
    unsigned long len;

    if (ctx->have_error) {
        return;
    }
    if (JSONSL_STATE_IS_CONTAINER(state)) {
        return;
    }
    if (state->type != JSONSL_T_HKEY) {
        return;
    }

    key = ctx->current_buf.base + state->pos_begin;
    len = jsn->pos - state->pos_begin;
    NORMALIZE_OFFSETS(key, len);

    lcb_string_clear(&ctx->last_hk);
    buffer_append(&ctx->last_hk, key, len);

    (void)action; (void)at;
}

/**
 * This is called for the first few tokens, where we are still searching
 * for the row set.
 */
static void
initial_push_callback(jsonsl_t jsn, jsonsl_action_t action,
    struct jsonsl_state_st *state, const jsonsl_char_t *at)
{
    lcbjsp_PARSER *ctx = (lcbjsp_PARSER*)jsn->data;
    jsonsl_jpr_match_t match = JSONSL_MATCH_UNKNOWN;

    if (ctx->have_error) {
        return;
    }

    if (JSONSL_STATE_IS_CONTAINER(state)) {
        jsonsl_jpr_match_state(jsn, state, ctx->last_hk.base, ctx->last_hk.nused,
            &match);
    }

    lcb_string_clear(&ctx->last_hk);

    if (ctx->initialized == 0) {
        if (state->type != JSONSL_T_OBJECT) {
            ctx->have_error = 1;
            return;
        }

        if (match != JSONSL_MATCH_POSSIBLE) {
            ctx->have_error = 1;
            return;
        }
        /* tag the state */
        state->data = JOBJ_RESPONSE_ROOT;
        ctx->initialized = 1;
        return;
    }

    if (state->type == JSONSL_T_LIST && match == JSONSL_MATCH_POSSIBLE) {
        /* we have a match, e.g. "rows:[]" */
        jsn->action_callback_POP = row_pop_callback;
        jsn->action_callback_PUSH = meta_header_complete_callback;
        state->data = JOBJ_ROWSET;
    }

    (void)action; /* always PUSH */
    (void)at;
}

static void
feed_data(lcbjsp_PARSER *ctx, const char *data, size_t ndata)
{
    size_t old_len = ctx->current_buf.nused;

    buffer_append(&ctx->current_buf, data, ndata);
    jsonsl_feed(ctx->jsn, ctx->current_buf.base + old_len, ndata);

    /* Do we need to cut off some bytes? */
    if (ctx->keep_pos > ctx->min_pos) {
        size_t lentmp, diff = ctx->keep_pos - ctx->min_pos;
        const char *buf = get_buffer_region(ctx, ctx->keep_pos, -1, &lentmp);
        memmove(ctx->current_buf.base, buf, ctx->current_buf.nused - diff);
        ctx->current_buf.nused -= diff;
    }

    ctx->min_pos = ctx->keep_pos;
}

/* Non-static wrapper */
void
lcbjsp_feed(lcbjsp_PARSER *ctx, const char *data, size_t ndata)
{
    feed_data(ctx, data, ndata);
}

lcbjsp_PARSER*
lcbjsp_create(int mode)
{
    lcbjsp_PARSER *ctx;
    jsonsl_error_t err;

    ctx = reinterpret_cast<lcbjsp_PARSER*>(calloc(1, sizeof(*ctx)));
    ctx->jsn = jsonsl_new(512);
    ctx->mode = mode;
    ctx->cxx_data = new Json::Value();

    if (ctx->mode == LCBJSP_MODE_VIEWS) {
        ctx->jpr = jsonsl_jpr_new("/rows/^", &err);
    } else if (ctx->mode == LCBJSP_MODE_N1QL) {
        ctx->jpr = jsonsl_jpr_new("/results/^", &err);
    } else {
        ctx->jpr = jsonsl_jpr_new("/hits/^", &err);
    }
    ctx->jsn_rdetails = jsonsl_new(32);

    lcb_string_init(&ctx->meta_buf);
    lcb_string_init(&ctx->current_buf);
    lcb_string_init(&ctx->last_hk);

    if (!ctx->jpr) { abort(); }
    if (!ctx->jsn_rdetails) { abort(); }

    jsonsl_jpr_match_state_init(ctx->jsn, &ctx->jpr, 1);
    assert(ctx->jsn_rdetails);

    lcbjsp_reset(ctx);
    assert(ctx->jsn_rdetails);
    return ctx;
}

void
lcbjsp_get_postmortem(const lcbjsp_PARSER *v, lcb_IOV *out)
{
    if (v->meta_complete) {
        out->iov_base = v->meta_buf.base;
        out->iov_len = v->meta_buf.nused;
    } else {
        out->iov_base = v->current_buf.base;
        out->iov_len = v->current_buf.nused;
    }
}

void
lcbjsp_reset(lcbjsp_PARSER* ctx)
{
    /**
     * We create a copy, and set its relevant fields. All other
     * fields are zeroed implicitly. Then we copy the object back.
     */
    jsonsl_reset(ctx->jsn);
    jsonsl_reset(ctx->jsn_rdetails);

    lcb_string_clear(&ctx->current_buf);
    lcb_string_clear(&ctx->meta_buf);
    lcb_string_clear(&ctx->last_hk);

    /* Initially all callbacks are enabled so that we can search for the
     * rows array. */
    ctx->jsn->action_callback_POP = initial_pop_callback;
    ctx->jsn->action_callback_PUSH = initial_push_callback;
    ctx->jsn->error_callback = parse_error_callback;
    ctx->jsn->max_callback_level = 4;
    ctx->jsn->data = ctx;
    jsonsl_enable_all_callbacks(ctx->jsn);

    ctx->have_error = 0;
    ctx->initialized = 0;
    ctx->meta_complete = 0;
    ctx->rowcount = 0;
    ctx->min_pos = 0;
    ctx->keep_pos = 0;
    ctx->header_len = 0;
    ctx->last_row_endpos = 0;
    reinterpret_cast<Json::Value*>(ctx->cxx_data)->clear();
}

void
lcbjsp_free(lcbjsp_PARSER *ctx)
{
    jsonsl_jpr_match_state_cleanup(ctx->jsn);
    jsonsl_destroy(ctx->jsn);
    jsonsl_destroy(ctx->jsn_rdetails);
    jsonsl_jpr_destroy(ctx->jpr);

    lcb_string_release(&ctx->current_buf);
    lcb_string_release(&ctx->meta_buf);
    lcb_string_release(&ctx->last_hk);
    delete reinterpret_cast<Json::Value*>(ctx->cxx_data);

    free(ctx);
}

typedef struct {
    const char *root;
    lcb_IOV *next_iov;
    lcbjsp_ROW *datum;
    lcbjsp_PARSER *parent;
} miniparse_ctx;

static void
parse_json_docid(lcb_IOV* iov, lcbjsp_PARSER *parent)
{
    Json::Reader r;
    const char *s = static_cast<char*>(iov->iov_base);
    const char *s_end = s + iov->iov_len;
    Json::Value *jvp = reinterpret_cast<Json::Value*>(parent->cxx_data);
    bool rv = r.parse(s, s_end, *jvp);
    if (!rv) {
        // fprintf(stderr, "libcouchbase: Failed to parse document ID as JSON!\n");
        return;
    }

    s = NULL;
    s_end = NULL;

    assert(jvp->isString());

    // Re-use s and s_end values for the string value itself
    if (!jvp->getString(&s, &s_end)) {
        // fprintf(stderr, "libcouchbase: couldn't get string value!\n");
        iov->iov_base = NULL;
        iov->iov_len = 0;
    }
    iov->iov_base = const_cast<char*>(s);
    iov->iov_len = s_end - s;
}

static void
miniparse_callback(jsonsl_t jsn, jsonsl_action_t action,
    struct jsonsl_state_st *state, const jsonsl_char_t *at)
{
    miniparse_ctx *ctx = reinterpret_cast<miniparse_ctx*>(jsn->data);
    lcb_IOV *iov;

    if (state->level == 1) {
        return;
    }

    /* Is a hashkey? */
    if (state->type == JSONSL_T_HKEY) {
        size_t nhk = state->pos_cur - state->pos_begin;

        nhk--;

        #define IS_ROWFIELD(s) \
            (nhk == sizeof(s)-1 && !strncmp(s, at- (sizeof(s)-1) , sizeof(s)-1) )

        if (IS_ROWFIELD("id")) {
            /* "id" */
            ctx->next_iov = &ctx->datum->docid;
        } else if (IS_ROWFIELD("key")) {
            /* "key" */
            ctx->next_iov = &ctx->datum->key;
        } else if (IS_ROWFIELD("value")) {
            /* "value" */
            ctx->next_iov = &ctx->datum->value;
        } else if (IS_ROWFIELD("geometry")) {
            ctx->next_iov = &ctx->datum->geo;
        } else {
            ctx->next_iov = NULL;
        }
        #undef IS_ROWFIELD
        return;
    }

    if (ctx->next_iov == NULL) {
        return;
    }

    iov = ctx->next_iov;

    if (JSONSL_STATE_IS_CONTAINER(state)) {
        iov->iov_base = (void *) (ctx->root + state->pos_begin);
        iov->iov_len = (jsn->pos - state->pos_begin) + 1;
    } else if (iov == &ctx->datum->docid) {
        if (state->nescapes) {
            iov->iov_base = (void *) (ctx->root + state->pos_begin);
            iov->iov_len = (state->pos_cur - state->pos_begin) + 1;
            parse_json_docid(iov, ctx->parent);
        } else {
            iov->iov_base = (void *) (ctx->root + state->pos_begin + 1);
            iov->iov_len = (state->pos_cur - state->pos_begin) - 1;
        }
    } else {
        iov->iov_base = (void *) (ctx->root + state->pos_begin);
        iov->iov_len = state->pos_cur - state->pos_begin;
        if (state->type == JSONSL_T_STRING) {
            iov->iov_len++;
        }
    }
    (void)at; (void)action;
}

void
lcbjsp_parse_viewrow(lcbjsp_PARSER *vp, lcbjsp_ROW *vr)
{
    miniparse_ctx ctx = { NULL };
    ctx.datum = vr;
    ctx.root = static_cast<const char*>(vr->row.iov_base);
    ctx.parent = vp;

    jsonsl_reset(vp->jsn_rdetails);

    jsonsl_enable_all_callbacks(vp->jsn_rdetails);
    vp->jsn_rdetails->max_callback_level = 3;
    vp->jsn_rdetails->action_callback_POP = miniparse_callback;
    vp->jsn_rdetails->data = &ctx;

    jsonsl_feed(vp->jsn_rdetails,
        static_cast<const char*>(vr->row.iov_base), vr->row.iov_len);
}
