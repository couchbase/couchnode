#ifndef LCB_AUTH_H
#define LCB_AUTH_H

#ifdef __cplusplus
#include <map>
#include <string>
namespace lcb { class Authenticator; }
typedef lcb::Authenticator lcb_AUTHENTICATOR;
extern "C" {
#else /* C only! */
typedef struct lcb_AUTHENTICATOR_Cdummy lcb_AUTHENTICATOR;
#endif

lcb_AUTHENTICATOR *
lcbauth_new(void);

void
lcbauth_free(lcb_AUTHENTICATOR *);

const char *
lcbauth_get_bpass(const lcb_AUTHENTICATOR *auth, const char *name);

void
lcbauth_set(lcb_AUTHENTICATOR *auth,
    const char *user, const char *pass, int is_global);

void
lcb_authenticator_clear(lcb_AUTHENTICATOR *auth);

void
lcbauth_get_upass(const lcb_AUTHENTICATOR *auth,
    const char **u, const char **p);

#ifdef __cplusplus
}
namespace lcb {
class Authenticator {
public:
    typedef std::map<std::string,std::string> Map;
    const std::string& username() const { return m_username; }
    const std::string& password() const { return m_password; }
    const Map& buckets() const { return m_buckets; }

    // todo: refactor these out
    Map m_buckets;
    std::string m_username;
    std::string m_password;

    lcb_error_t init(const std::string& username_, const std::string& bucket,
        const std::string& password, lcb_type_t conntype);
};
}
#endif
#endif /* LCB_AUTH_H */
