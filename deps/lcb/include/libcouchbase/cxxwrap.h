#ifndef LCB_CXXWRAP_H
#define LCB_CXXWRAP_H
#ifndef LIBCOUCHBASE_COUCHBASE_H
#error "include <libcouchbase/couchbase.h> first"
#endif

lcb_get_cmd_st::lcb_get_cmd_st() {
    std::memset(this, 0, sizeof(*this));
}

lcb_get_cmd_st::lcb_get_cmd_st(const void *key, lcb_size_t nkey, lcb_time_t exptime, int lock) {
    version = 0;
    v.v0.key = key;
    if (key != NULL && nkey == 0) {
        v.v0.nkey = std::strlen((const char *)key);
    } else {
        v.v0.nkey = nkey;
    }
    v.v0.exptime = exptime;
    v.v0.lock = lock;
    v.v0.hashkey = NULL;
    v.v0.nhashkey = 0;
}

lcb_get_replica_cmd_st::lcb_get_replica_cmd_st() {
    std::memset(this, 0, sizeof(*this));
}

lcb_get_replica_cmd_st::lcb_get_replica_cmd_st(
        const void *key, lcb_size_t nkey, lcb_replica_t strategy, int index) {
    version = 1;
    v.v1.key = key;
    v.v1.nkey = nkey;
    v.v1.hashkey = NULL;
    v.v1.nhashkey = 0;
    v.v1.strategy = strategy;
    v.v1.index = index;
}

lcb_unlock_cmd_st::lcb_unlock_cmd_st() {
    std::memset(this, 0, sizeof(*this));
}

lcb_unlock_cmd_st::lcb_unlock_cmd_st(const void *key, lcb_size_t nkey, lcb_cas_t cas) {
    version = 0;
    v.v0.key = key;
    v.v0.nkey = nkey;
    v.v0.cas = cas;
    v.v0.hashkey = NULL;
    v.v0.nhashkey = 0;
}

lcb_store_cmd_st::lcb_store_cmd_st() {
    std::memset(this, 0, sizeof(*this));
}

lcb_store_cmd_st::lcb_store_cmd_st(
        lcb_storage_t operation, const void *key, lcb_size_t nkey,
        const void *bytes, lcb_size_t nbytes, lcb_uint32_t flags,
        lcb_time_t exptime, lcb_cas_t cas, lcb_datatype_t datatype) {
    version = 0;
    v.v0.operation = operation;
    v.v0.key = key;
    v.v0.nkey = nkey;
    v.v0.cas = cas;
    v.v0.bytes = bytes;
    v.v0.nbytes = nbytes;
    v.v0.flags = flags;
    v.v0.datatype = datatype;
    v.v0.exptime = exptime;
    v.v0.hashkey = NULL;
    v.v0.nhashkey = 0;
}

lcb_arithmetic_cmd_st::lcb_arithmetic_cmd_st()
{
    std::memset(this, 0, sizeof(*this));
}

lcb_arithmetic_cmd_st::lcb_arithmetic_cmd_st(
        const void *key, lcb_size_t nkey, lcb_int64_t delta, int create,
        lcb_uint64_t initial, lcb_time_t exptime)

{
   version = 0;
   v.v0.key = key;
   v.v0.nkey = nkey;
   v.v0.exptime = exptime;
   v.v0.delta = delta;
   v.v0.create = create;
   v.v0.initial = initial;
   v.v0.hashkey = NULL;
   v.v0.nhashkey = 0;
}

lcb_observe_cmd_st::lcb_observe_cmd_st() {
    std::memset(this, 0, sizeof(*this));
}

lcb_observe_cmd_st::lcb_observe_cmd_st(const void *key, lcb_size_t nkey) {
    version = 0;
    v.v0.key = key;
    v.v0.nkey = nkey;
    v.v0.hashkey = NULL;
    v.v0.nhashkey = 0;
}

lcb_remove_cmd_st::lcb_remove_cmd_st() {
    std::memset(this, 0, sizeof(*this));
}

lcb_remove_cmd_st::lcb_remove_cmd_st(
        const void *key, lcb_size_t nkey, lcb_cas_t cas) {
    version = 0;
    v.v0.key = key;
    if (key != NULL && nkey == 0) {
        v.v0.nkey = std::strlen((const char *)key);
    } else {
        v.v0.nkey = nkey;
    }
    v.v0.cas = cas;
    v.v0.hashkey = NULL;
    v.v0.nhashkey = 0;
}

lcb_server_stats_cmd_st::lcb_server_stats_cmd_st(const char *name, lcb_size_t nname)
{
    version = 0;
    v.v0.name = name;
    v.v0.nname = nname;
    if (name != NULL && nname == 0) {
        v.v0.nname = std::strlen(name);
    } else {
        v.v0.nname = nname;
    }
}

lcb_verbosity_cmd_st::lcb_verbosity_cmd_st(lcb_verbosity_level_t level, const char *server)
{
    version = 0;
    v.v0.server = server;
    v.v0.level = level;

}

lcb_create_st::lcb_create_st(
        const char *host, const char *user, const char *passwd, const char *bucket,
        struct lcb_io_opt_st *io, lcb_type_t type) {
    version = 2;
    v.v2.host = host;
    v.v2.user = user;
    v.v2.passwd = passwd;
    v.v2.bucket = bucket;
    v.v2.io = io;
    v.v2.type = type;
    v.v2.mchosts = NULL;
    v.v2.transports = NULL;
}


lcb_http_cmd_st::lcb_http_cmd_st() {
    std::memset(this, 0, sizeof(*this));
}

lcb_http_cmd_st::lcb_http_cmd_st(const char *path, lcb_size_t npath, const void *body,
                lcb_size_t nbody, lcb_http_method_t method,
                int chunked, const char *content_type) {
    version = 0;
    v.v0.path = path;
    v.v0.npath = npath;
    v.v0.body = body;
    v.v0.nbody = nbody;
    v.v0.method = method;
    v.v0.chunked = chunked;
    v.v0.content_type = content_type;
}
#endif
