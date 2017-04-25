#ifndef LCB_AUTH_PRIV_H
#define LCB_AUTH_PRIV_H
#include <libcouchbase/auth.h>

#ifdef __cplusplus
#include <string>
#include <map>

namespace lcb {
class Authenticator {
public:
    typedef std::map<std::string,std::string> Map;
    // Gets the "global" username
    const std::string& username() const { return m_username; }

    // Gets the "global" password
    const std::string& password() const { return m_password; }

    // Get the username and password for a specific bucket
    const std::string& username_for(const char *bucket) const;
    const std::string& password_for(const char *bucket) const;

    const Map& buckets() const { return m_buckets; }
    Authenticator() : m_refcount(1), m_mode(LCBAUTH_MODE_CLASSIC) {}
    Authenticator(const Authenticator&);

    size_t refcount() const { return m_refcount; }
    void incref() { ++m_refcount; }
    void decref() { if (!--m_refcount) { delete this; } }
    lcb_error_t set_mode(lcbauth_MODE mode_) {
        if (m_buckets.size() || m_username.size() || m_password.size()) {
            return LCB_ERROR;
        } else {
            m_mode = mode_;
            return LCB_SUCCESS;
        }
    }
    lcbauth_MODE mode() const { return m_mode; }
    lcb_error_t add(const char *user, const char *pass, int flags);
    lcb_error_t add(const std::string& user, const std::string& pass, int flags) {
        return add(user.c_str(), pass.c_str(), flags);
    }

private:
    Map m_buckets;
    std::string m_username;
    std::string m_password;
    size_t m_refcount;
    lcbauth_MODE m_mode;
};
}
#endif
#endif /* LCB_AUTH_H */
