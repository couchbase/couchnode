#ifndef LCB_ERRMAP_H
#define LCB_ERRMAP_H

#ifdef __cplusplus

#include <map>
#include <set>
#include <string>

namespace lcb {
namespace errmap {

enum ErrorAttribute {
#define LCB_XERRMAP_ATTRIBUTES(X) \
    X(TEMPORARY, "temp") \
    X(SUBDOC, "subdoc") \
    X(RETRY_NOW, "retry-now") \
    X(RETRY_LATER, "retry-later") \
    X(INVALID_INPUT, "invalid-input") \
    X(NOT_ENABLED, "support") \
    X(AUTH, "auth") \
    X(CONN_STATE_INVALIDATED, "conn-state-invalidated") \
    X(CONSTRAINT_FAILURE, "item-only") \
    X(RETRY_EXP_BACKOFF, "retry-exp-backoff") \
    X(RETRY_LINEAR_BACKOFF, "retry-linear-backoff") \
    X(INTERNAL, "internal") \
    X(DCP, "dcp") \
    X(FETCH_CONFIG, "fetch-config") \
    X(SPECIAL_HANDLING, "special-handling") \
    X(AUTO_RETRY, "auto-retry")

    #define X(c, s) c,
    LCB_XERRMAP_ATTRIBUTES(X)
    #undef X

    INVALID_ATTRIBUTE
};

struct Error {
    uint16_t code;
    std::string shortname;
    std::string description;
    std::set<ErrorAttribute> attributes;

    Error() : code(-1) {
    }

    bool isValid() const {
        return code != uint16_t(-1);
    }

    bool hasAttribute(ErrorAttribute attr) const {
        return attributes.find(attr) != attributes.end();
    }
};

class ErrorMap {
public:
    enum ParseStatus {
        /** Couldn't parse JSON!*/
        PARSE_ERROR,

        /** Version is too high */
        UNKNOWN_VERSION,

        /** Current version/revision is higher or equal */
        NOT_UPDATED,

        /** Updated */
        UPDATED
    };

    ErrorMap();
    ParseStatus parse(const char *s, size_t n, std::string& errmsg);
    ParseStatus parse(const char *s, size_t n) {
        std::string tmp;
        return parse(s, n, tmp);
    }
    size_t getVersion() const { return version; }
    size_t getRevision() const { return revision; };
    const Error& getError(uint16_t code) const;
    bool isLoaded() const {
        return !errors.empty();
    }

private:
    static const uint32_t MAX_VERSION;
    ErrorMap(const ErrorMap&);
    typedef std::map<uint16_t, Error> MapType;
    MapType errors;
    uint32_t revision;
    uint32_t version;
};

} // namespace
} // namespace

typedef lcb::errmap::ErrorMap* lcb_pERRMAP;
#else
typedef struct lcb_ERRMAP* lcb_pERRMAP;
#endif /* __cplusplus */

#ifdef __cplusplus
extern "C" {
#endif

lcb_pERRMAP lcb_errmap_new(void);
void lcb_errmap_free(lcb_pERRMAP);

#ifdef __cplusplus
}
#endif

#endif /* LCB_ERRMAP_H */
