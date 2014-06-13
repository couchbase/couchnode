#ifndef LCB_DSN_H
#define LCB_DSN_H

#include <libcouchbase/couchbase.h>
#include "config.h"
#include "simplestring.h"
#include "list.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    lcb_list_t llnode;
    lcb_U16 port;
    short type;
    char hostname[1];
#ifdef __cplusplus
    bool isSSL() const { return type == LCB_CONFIG_MCD_SSL_PORT || type == LCB_CONFIG_HTTP_SSL_PORT; }
    bool isHTTPS() const { return type == LCB_CONFIG_HTTP_SSL_PORT; }
    bool isHTTP() const { return type == LCB_CONFIG_HTTP_PORT; }
    bool isMCD() const { return type == LCB_CONFIG_MCD_PORT; }
    bool isMCDS() const { return type == LCB_CONFIG_MCD_SSL_PORT; }
    bool isTypeless() const { return type == 0 ; }
#endif

} lcb_DSNHOST;

typedef struct {
    char *ctlopts; /**< Iterator for option string. opt1=val1&opt2=val2 */
    unsigned optslen; /**< Total number of bytes in ctlopts */
    char *bucket; /**< Bucket string. Free with 'free()' */
    char *username; /**< Username. Currently not used */
    char *password; /**< Password */
    char *capath; /**< Certificate path */
    char *origdsn; /** Original DSN passed */
    lcb_SSLOPTS sslopts; /**< SSL Options */
    lcb_list_t hosts; /**< List of host information */
    lcb_U16 implicit_port; /**< Implicit port, based on scheme */
    int loglevel; /* cached loglevel */
    unsigned flags; /**< Internal flags */
    lcb_config_transport_t transports[LCB_CONFIG_TRANSPORT_MAX];
} lcb_DSNPARAMS;

#define LCB_DSN_SCHEME_RAW "couchbase+explicit://"
#define LCB_DSN_SCHEME_MCD "couchbase://"
#define LCB_DSN_SCHEME_MCD_SSL "couchbases://"
#define LCB_DSN_SCHEME_HTTP "http://"
#define LCB_DSN_SCHEME_HTTP_SSL "https-internal://"

/**
 * Compile a DSN into a structure suitable for further processing. A Couchbase
 * DSN consists of a mandatory _scheme_ (currently only `couchbase://`) is
 * recognized, an optional _authority_ section, an optional _path_ section,
 * and an optional _parameters_ section.
 */
LIBCOUCHBASE_API
lcb_error_t
lcb_dsn_parse(const char *dsn, lcb_DSNPARAMS *compiled, const char **errmsg);

/**
 * Convert an older lcb_create_st structure to an lcb_DSNPARAMS structure.
 * @param params structure to be populated
 * @param cropts structure to read from
 * @return error code on failure, LCB_SUCCESS on success.
 */
LIBCOUCHBASE_API
lcb_error_t
lcb_dsn_convert(lcb_DSNPARAMS *params, const struct lcb_create_st *cropts);

LIBCOUCHBASE_API
void
lcb_dsn_clean(lcb_DSNPARAMS *params);

/**
 * Iterate over the option pairs found in the original string. This iterates
 * over all _unrecognized_ options.
 *
 * @param params The compiled DSN context
 * @param[out] key a pointer to the option key
 * @param[out] value a pointer to the option value
 * @param[in,out] ctx iterator. This should be initialized to 0 upon the
 * first call
 * @return true if an option was fetched (and thus `key` and `value` contain
 * valid pointers) or false if there are no more options.
 */
LIBCOUCHBASE_API
int
lcb_dsn_next_option(const lcb_DSNPARAMS *params,
    const char **key, const char **value, int *ctx);


#ifdef __cplusplus
}
#endif
#endif
