#ifndef LCB_SSL_H
#define LCB_SSL_H
#include <lcbio/connect.h>
#ifdef __cplusplus
extern "C" {
#endif

/**
 * @file
 * @brief SSL Socket Routines
 */

/**
 * @ingroup LCBIO
 * @defgroup LCBIO_SSL SSL Routines
 *
 * @details
 * This file contains the higher level API interfacing with _LCBIO_. It provides
 * APIs to "patch" a socket with SSL as well as establish settings for SSL
 * encryption.
 *
 * @addtogroup LCBIO_SSL
 * @{
 */


/** @brief Wrapper around OpenSSL's `SSL_CTX` */
typedef struct lcbio_SSLCTX *lcbio_pSSLCTX;

/**
 * @brief Determine if SSL is supported in the current build
 * @return true if supported, false otherwise
 */
int
lcbio_ssl_supported(void);

#ifndef LCB_NO_SSL

/**
 * Create a new SSL context to be used to establish SSL policy.
 * @param cafile Optional path to CA file
 * @param noverify To not attempt to verify server's certificate
 * @return A new SSL context
 */
lcbio_pSSLCTX
lcbio_ssl_new(const char *cafile, int noverify);

/**
 * Free the SSL context. This should be done when libcouchbase has nothing else
 * to do with the certificate
 * @param ctx
 */
void
lcbio_ssl_free(lcbio_pSSLCTX ctx);

/**
 * Apply the SSL settings to a given socket.
 *
 * The socket must be newly connected and must not have already been initialized
 * with SSL (i.e. lcbio_ssl_check() returns false).
 *
 * @param sock The socket to which SSL should be applied
 * @param sctx The context returned by lcbio_ssl_new()
 * @return
 */
lcb_error_t
lcbio_ssl_apply(lcbio_SOCKET *sock, lcbio_pSSLCTX sctx);

/**
 * Checks whether the given socket is using SSL
 * @param sock The socket to check
 * @return true if using SSL, false if plain (or not yet applied)
 */
int
lcbio_ssl_check(lcbio_SOCKET *sock);

/**
 * @brief
 * Initialize any application-level globals needed for SSL support
 * @todo There is currently nothing checking if this hasn't been called more
 * than once.
 */
void
lcbio_ssl_global_init(void);

struct lcb_settings_st;

/**
 * Apply SSL to the socket if the socket should use SSL and is not already
 * an SSL socket. This is a convenience function that:
 *
 * 1. Checks the settings to see if SSL is enabled
 * 2. Checks to see if the socket already has SSL (lcbio_ssl_check())
 * 3. Calls lcbio_ssl_apply if (1) and (2) are true.
 *
 * @param sock The socket to SSLify
 * @param settings The settings structure from whence the context and policy are
 * derived.
 * @return
 */
lcb_error_t
lcbio_sslify_if_needed(lcbio_SOCKET *sock, struct lcb_settings_st *settings);

#else
/* SSL Disabled */
#define lcbio_ssl_new(a,b) NULL
#define lcbio_ssl_free(ctx)
#define lcbio_ssl_apply(sock, sctx) LCB_NOT_SUPPORTED
#define lcbio_ssl_check(sock) 0
#define lcbio_ssl_global_init() 0
#define lcbio_sslify_if_needed(sock, settings) LCB_SUCCESS
#endif /*LCB_NO_SSL*/

/**@}*/

#ifdef __cplusplus
}
#endif
#endif
