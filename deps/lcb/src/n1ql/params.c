#include <libcouchbase/couchbase.h>
#include <libcouchbase/n1ql.h>
#include "simplestring.h"
#include "strcodecs/strcodecs.h"

#define SCANVEC_NONE 0
#define SCANVEC_PARTIAL 1
#define SCANVEC_FULL 2

struct lcb_N1QLPARAMS_st {
    lcb_string posargs; /* Positional arguments */
    lcb_string form; /* Named arguments (and others)*/
    lcb_string scanvec;
    int scanvec_type;
    int consist_type;
};

static size_t get_strlen(const char *s, size_t n)
{
    if (n == (size_t)-1) {
        return strlen(s);
    } else {
        return n;
    }
}

static int
add_encstr(lcb_string *str, const char *s, size_t n)
{
    /* Reserve data */
    size_t n_added;
    if (-1 == lcb_string_reserve(str, n * 3)) {
        return -1;
    }
    n_added = lcb_formencode(s, n, str->base + str->nused);
    lcb_string_added(str, n_added);
    return 0;
}

lcb_error_t
lcb_n1p_setopt(lcb_N1QLPARAMS *params,
    const char *k, size_t nk, const char *v, size_t nv)
{
    nv = get_strlen(v, nv);
    nk = get_strlen(k, nk);
    /* Do we need the '&'? */
    if (params->form.nused) {
        if (-1 == lcb_string_append(&params->form, "&", 1)) {
            return LCB_CLIENT_ENOMEM;
        }
    }
    if (-1 == add_encstr(&params->form, k, nk)) {
        return LCB_CLIENT_ENOMEM;
    }
    if (-1 == lcb_string_append(&params->form, "=", 1)) {
        return LCB_CLIENT_ENOMEM;
    }
    if (-1 == add_encstr(&params->form, v, nv)) {
        return LCB_CLIENT_ENOMEM;
    }
    return LCB_SUCCESS;

}

lcb_error_t
lcb_n1p_setquery(lcb_N1QLPARAMS *params,
    const char *qstr, size_t nqstr, int type)
{
    if (type == LCB_N1P_QUERY_STATEMENT) {
        return lcb_n1p_setopt(params, "statement", -1, qstr, nqstr);
    } else if (type == LCB_N1P_QUERY_PREPARED) {
        return lcb_n1p_setopt(params, "prepared", -1, qstr, nqstr);
    } else {
        return LCB_EINVAL;
    }
}

lcb_error_t
lcb_n1p_namedparam(lcb_N1QLPARAMS *params,
    const char *name, size_t nname, const char *value, size_t nvalue)
{
    return lcb_n1p_setopt(params, name, nname, value, nvalue);
}

lcb_error_t
lcb_n1p_posparam(lcb_N1QLPARAMS *params, const char *value, size_t nvalue)
{
    nvalue = get_strlen(value, nvalue);
    if (-1 == lcb_string_reserve(&params->posargs, nvalue+3)) {
        return LCB_CLIENT_ENOMEM;
    }

    if (!params->posargs.nused) {
        lcb_string_append(&params->posargs, "[", 1);
    } else {
        lcb_string_append(&params->posargs, ",", 1);
    }
    lcb_string_append(&params->posargs, value, nvalue);
    return LCB_SUCCESS;
}


#define DIGITS_64 20
#define DIGITS_16 5
#define SCANVEC_BASEFMT "\"%u\":{\"uuid\":\"%llu\",\"seqno\":%llu}"
#define PARAM_CONSISTENT "scan_consistency"

#define SCANVEC_BASE_SIZE \
    (sizeof(SCANVEC_BASEFMT) + (DIGITS_64 * 2) + DIGITS_16 + 5)

lcb_error_t
lcb_n1p_scanvec(lcb_N1QLPARAMS *params, const lcb_N1QLSCANVEC *sv)
{
    size_t np;

    if (params->scanvec_type == SCANVEC_FULL) {
        return LCB_OPTIONS_CONFLICT;
    }

    params->consist_type = LCB_N1P_CONSISTENCY_RYOW;

    /* Reserve data: */
    if (-1 == lcb_string_reserve(&params->scanvec, SCANVEC_BASE_SIZE)) {
        return LCB_CLIENT_ENOMEM;
    }

    if (!params->scanvec.nused) {
        lcb_string_append(&params->scanvec, "{", 1);
    } else {
        lcb_string_append(&params->scanvec, ",", 1);
    }

    np = sprintf(params->scanvec.base + params->scanvec.nused, SCANVEC_BASEFMT,
        sv->vbid_,
        (unsigned long long)sv->uuid_,
        (unsigned long long)sv->seqno_);

    lcb_string_added(&params->scanvec, np);
    params->scanvec_type = SCANVEC_PARTIAL;
    return LCB_SUCCESS;
}

lcb_error_t
lcb_n1p_setconsistency(lcb_N1QLPARAMS *params, int mode)
{
    switch (mode) {
    case LCB_N1P_CONSISTENCY_NONE:
    case LCB_N1P_CONSISTENCY_REQUEST:
    case LCB_N1P_CONSISTENCY_RYOW:
    case LCB_N1P_CONSISTENCY_STATMENT:
        params->consist_type = mode;
        return LCB_SUCCESS;
    default:
        return LCB_EINVAL;
    }
}

static lcb_error_t
finalize_field(lcb_N1QLPARAMS *params, lcb_string *ss,
    const char *field, const char *term)
{
    if (ss->nused == 0) {
        return LCB_SUCCESS;
    }
    if (-1 == lcb_string_append(ss, term, 1)) {
        return LCB_CLIENT_ENOMEM;
    }
    return lcb_n1p_setopt(params, field, -1, ss->base, ss->nused);
}

lcb_error_t
lcb_n1p_mkcmd(lcb_N1QLPARAMS *params, lcb_CMDN1QL *cmd)
{
    lcb_error_t err;
    /* Build the query */

    if (!params->form.nused) {
        return LCB_EINVAL; /* Empty! */
    }

    if ((err = finalize_field(params, &params->posargs, "args", "]"))
            != LCB_SUCCESS) {
        return err;
    }
    if (params->scanvec.nused) {
        if (params->consist_type != LCB_N1P_CONSISTENCY_RYOW) {
            return LCB_OPTIONS_CONFLICT;
        }
        if ((err = finalize_field(params, &params->scanvec, "scan_vector", "}"))
                != LCB_SUCCESS) {
            return err;
        }
    }

    if (params->consist_type) {
        if (-1 == lcb_string_reserve(&params->form, 15)) {
            return LCB_CLIENT_ENOMEM;
        }
    }

    if (params->consist_type == LCB_N1P_CONSISTENCY_RYOW) {
        if (!params->scanvec.nused) {
            return LCB_OPTIONS_CONFLICT;
        } else {
            lcb_n1p_setoptz(params, PARAM_CONSISTENT, "at_plus");
        }
    } else if (params->consist_type == LCB_N1P_CONSISTENCY_REQUEST) {
        lcb_n1p_setoptz(params, PARAM_CONSISTENT, "request_plus");
    } else if (params->consist_type == LCB_N1P_CONSISTENCY_STATMENT) {
        lcb_n1p_setoptz(params, PARAM_CONSISTENT, "statement_plus");
    } else if (params->consist_type == LCB_N1P_CONSISTENCY_NONE) {
    } else {
        return LCB_EINVAL;
    }


    cmd->content_type = "application/x-www-form-urlencoded";
    cmd->query = params->form.base;
    cmd->nquery = params->form.nused;
    return LCB_SUCCESS;
}

lcb_N1QLPARAMS *
lcb_n1p_new(void)
{
    return calloc(1, sizeof(lcb_N1QLPARAMS));
}

void
lcb_n1p_reset(lcb_N1QLPARAMS *params)
{
    lcb_string_clear(&params->form);
    lcb_string_clear(&params->posargs);
    lcb_string_clear(&params->scanvec);
    params->scanvec_type = SCANVEC_NONE;
}

void
lcb_n1p_free(lcb_N1QLPARAMS *params)
{
    lcb_string_release(&params->form);
    lcb_string_release(&params->posargs);
    lcb_string_release(&params->scanvec);
    free(params);
}
