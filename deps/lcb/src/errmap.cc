#include "internal.h"
#include "errmap.h"
#include "contrib/lcb-jsoncpp/lcb-jsoncpp.h"

using namespace lcb::errmap;

ErrorMap::ErrorMap() : revision(0), version(0) {
}

static ErrorAttribute getAttribute(const std::string& s) {
    #define X(c, s_) if (s == s_) { return c; }
    LCB_XERRMAP_ATTRIBUTES(X)
    #undef X
    return INVALID_ATTRIBUTE;
}

const uint32_t ErrorMap::MAX_VERSION = 1;

ErrorMap::ParseStatus
ErrorMap::parse(const char *s, size_t n, std::string& errmsg) {
    Json::Value root_nonconst;
    Json::Reader reader;
    if (!reader.parse(s, s + n, root_nonconst)) {
        errmsg = "Invalid JSON";
        return PARSE_ERROR;
    }

    const Json::Value& root = root_nonconst;
    const Json::Value& verJson = root["version"];
    if (!verJson.isNumeric()) {
        errmsg = "'version' is not a number";
        return PARSE_ERROR;
    }

    if (verJson.asUInt() > MAX_VERSION) {
        errmsg = "'version' is unreasonably high";
        return UNKNOWN_VERSION;
    }

    const Json::Value& revJson = root["revision"];
    if (!revJson.isNumeric()) {
        errmsg = "'revision' is not a number";
        return PARSE_ERROR;
    }

    if (revJson.asUInt() <= revision) {
        return NOT_UPDATED;
    }

    const Json::Value& errsJson = root["errors"];
    if (!errsJson.isObject()) {
        errmsg = "'errors' is not an object";
        return PARSE_ERROR;
    }

    Json::Value::const_iterator ii = errsJson.begin();
    for (; ii != errsJson.end(); ++ii) {
        // Key is the version in hex
        unsigned ec = 0;
        if (sscanf(ii.key().asCString(), "%x", &ec) != 1) {
            errmsg = "key " + ii.key().asString() + " is not a hex number";
            return PARSE_ERROR;
        }

        const Json::Value& errorJson = *ii;

        // Descend into the error attributes
        Error error;
        error.code = static_cast<uint16_t>(ec);

        error.shortname = errorJson["name"].asString();
        error.description = errorJson["desc"].asString();

        const Json::Value& attrs = errorJson["attrs"];
        if (!attrs.isArray()) {
            errmsg = "'attrs' is not an array";
            return PARSE_ERROR;
        }

        Json::Value::const_iterator jj = attrs.begin();
        for (; jj != attrs.end(); ++jj) {
            ErrorAttribute attr = getAttribute(jj->asString());
            if (attr == INVALID_ATTRIBUTE) {
                errmsg = "unknown attribute received";
                return UNKNOWN_VERSION;
            }
            error.attributes.insert(attr);
        }
        errors.insert(MapType::value_type(ec, error));
    }

    return UPDATED;
}

const Error& ErrorMap::getError(uint16_t code) const {
    static const Error invalid;
    MapType::const_iterator it = errors.find(code);

    if (it != errors.end()) {
        return it->second;
    } else {
        return invalid;
    }
}

ErrorMap *lcb_errmap_new() { return new ErrorMap(); }
void lcb_errmap_free(ErrorMap* m) { delete m; }
