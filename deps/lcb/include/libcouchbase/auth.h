#ifndef LCB_AUTH_H
#define LCB_AUTH_H

#ifdef __cplusplus
namespace lcb { class Authenticator; }
typedef lcb::Authenticator lcb_AUTHENTICATOR;
extern "C" {
#else /* C only! */
typedef struct lcb_AUTHENTICATOR_Cdummy lcb_AUTHENTICATOR;
#endif

/**
 * @class lcb_AUTHENTICATOR
 *
 * The lcb_AUTHENTICATOR object allows greater flexibility with regard to
 * adding more than a single bucket/password credential pair. It also restores
 * the ability to use "true" usernames (though these are not used at present
 * yet).
 */

/**
 * @volatile
 * Creates a new authenticator object. You may destroy it using lcbauth_unref().
 * The returned object initially has a refcount of 1.
 *
 * @return A new authenticator object.
 */
LIBCOUCHBASE_API
lcb_AUTHENTICATOR *
lcbauth_new(void);

/**
 * Flags to use when adding a new set of credentials to lcbauth_add_pass
 */
typedef enum {
    /** User/Password is administrative; for cluster */
    LCBAUTH_F_CLUSTER = 1<<1,

    /** User is bucket name. Password is bucket password */
    LCBAUTH_F_BUCKET = 1<<2
} lcbauth_ADDPASSFLAGS;

/**
 * @volatile
 *
 * Add a set of credentials
 * @param auth
 * @param user the username (or bucketname, if LCBAUTH_F_BUCKET is passed)
 * @param pass the password. If the password is NULL, the credential is removed
 * @param flags one of @ref LCBAUTH_F_CLUSTER or @ref LCBAUTH_F_BUCKET.
 */
LIBCOUCHBASE_API
lcb_error_t
lcbauth_add_pass(lcb_AUTHENTICATOR *auth, const char *user, const char *pass, int flags);

/**
 * @volatile
 *
 * Gets the global username and password. This is either the lone bucket
 * password, or an explicit cluster password.
 * @param auth
 * @param[out] u Global username
 * @param[out] p Global password
 */
void
lcbauth_get_upass(const lcb_AUTHENTICATOR *auth, const char **u, const char **p);


/**
 * @private
 *
 * Get a user/bucket password
 * @param auth the authenticator
 * @param name the name of the bucket
 * @return the password for the bucket, or NULL if the bucket has no password
 * (or is unknown to the authenticator)
 */
const char *
lcbauth_get_bpass(const lcb_AUTHENTICATOR *auth, const char *name);

/**
 * @uncomitted
 * Increments the refcount on the authenticator object
 * @param auth
 */
LIBCOUCHBASE_API
void
lcbauth_ref(lcb_AUTHENTICATOR *auth);

/**
 * Decrements the refcount on the authenticator object
 * @param auth
 */
LIBCOUCHBASE_API
void
lcbauth_unref(lcb_AUTHENTICATOR *auth);

#ifdef __cplusplus
}
#endif
#endif /* LCB_AUTH_H */
