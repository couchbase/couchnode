#ifndef LCB_ERRMAP_H
#define LCB_ERRMAP_H

#ifdef __cplusplus
#include <map>
#include <set>
#include <string>
#include <cmath>

namespace Json { class Value; }

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

class RetrySpec {
public:
    enum Strategy { CONSTANT, LINEAR, EXPONENTIAL };
    // Grace time
    uint32_t after;

    // Maximum duration for retry.
    uint32_t max_duration;

    uint32_t get_next_interval(size_t num_attempts) const {
        uint32_t cur_interval = 0; // 50ms is a safe bet.
        if (strategy == CONSTANT) {
            return interval;
        } else if (strategy == LINEAR) {
            cur_interval = num_attempts * interval;
        } else if (strategy == EXPONENTIAL) {
            // Convert to ms for pow(), convert result back to us.
            cur_interval = std::pow((double)(interval / 1000), (int)num_attempts) * 1000;
        }
        if (ceil != 0) {
            // Note, I *could* use std::min here, but this file gets
            // included by other files, and Windows is giving a hard time
            // because it defines std::min as a macro. NOMINMAX is a possible
            // definition, but I'd rather not touch all including files
            // to contain that macro, and I don't want to add additional
            // preprocessor defs at this time.
            cur_interval = ceil > cur_interval ? cur_interval : ceil;
        }
        return cur_interval;
    }

    void ref() {
        refcount++;
    }

    void unref() {
        if (!--refcount) {
            delete this;
        }
    }

    static inline RetrySpec* parse(const Json::Value& specJson,
                                   std::string& errmsg);

private:
    Strategy strategy;

    // Base interval
    uint32_t interval;

    // Max interval
    uint32_t ceil;


    size_t refcount;
};

class SpecWrapper {
private:
    friend class RetrySpec;
    friend struct Error;
    friend class ErrorMap;

    RetrySpec *specptr;
    SpecWrapper() : specptr(NULL) {}
    SpecWrapper(const SpecWrapper& other) {
        specptr = other.specptr;
        if (specptr != NULL) {
            specptr->ref();
        }
    }
    ~SpecWrapper() {
        if (specptr) {
            specptr->unref();
        }
        specptr = NULL;
    }
};

struct Error {
    uint16_t code;
    std::string shortname;
    std::string description;
    std::set<ErrorAttribute> attributes;
    SpecWrapper retry;

    Error() : code(-1) {
    }

    bool isValid() const {
        return code != uint16_t(-1);
    }

    bool hasAttribute(ErrorAttribute attr) const {
        return attributes.find(attr) != attributes.end();
    }

    RetrySpec *getRetrySpec() const;
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
