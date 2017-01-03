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
    const std::string& username() const { return m_username; }
    const std::string& password() const { return m_password; }
    const Map& buckets() const { return m_buckets; }
    Authenticator() : m_refcount(1) {}

    size_t refcount() const { return m_refcount; }
    void incref() { ++m_refcount; }
    void decref() { if (!--m_refcount) { delete this; } }
    lcb_error_t add(const char *user, const char *pass, int flags);
    lcb_error_t init(const std::string& username_, const std::string& bucket,
        const std::string& password, lcb_type_t conntype);

private:
    // todo: refactor these out
    Map m_buckets;
    std::string m_username;
    std::string m_password;
    size_t m_refcount;
};
}
#endif
#endif /* LCB_AUTH_H */
