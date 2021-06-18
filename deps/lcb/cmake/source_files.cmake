# These define the various source file listings of various modules
# within the library.
# This is included by the top-level CMakeLists.txt

# couchbase_utils
SET(LCB_UTILS_SRC
    src/gethrtime.c
    src/list.c
    src/logging.c
    src/ringbuffer.c)

SET(LCB_UTILS_CXXSRC
    src/strcodecs/base64.cc)

# lcbio
FILE(GLOB LCB_IO_SRC src/lcbio/*.c)
FILE(GLOB LCB_IO_CXXSRC src/lcbio/*.cc)

# memcached packets
FILE(GLOB LCB_MC_SRC src/mc/*.c)
FILE(GLOB LCB_MC_CXXSRC src/mc/*.cc)

# read buffer management
FILE(GLOB LCB_RDB_SRC src/rdb/*.c)

# send buffer management
FILE(GLOB LCB_NETBUF_SRC src/netbuf/*.c)

# HTTP protocol management
LIST(APPEND LCB_HT_SRC "contrib/http_parser/http_parser.c")

SET(LCB_CORE_SRC
    src/callbacks.c
    src/iofactory.c)

FILE(GLOB LCB_TRACING_SRC src/tracing/*.cc)

SET(LCB_METRICS_SRC
    src/metrics/caching_meter.cc
    src/metrics/metrics.cc
    src/metrics/metrics-internal.cc)
if (LCB_USE_HDR_HISTOGRAM)
    LIST(APPEND LCB_METRICS_SRC src/metrics/logging_meter.cc)
endif()

FILE(GLOB LCB_CAPI_SRC src/capi/*.cc)

SET(LCB_CORE_CXXSRC
    src/analytics/analytics.cc
    src/analytics/analytics_handle.cc
    src/auth.cc
    src/bootstrap.cc
    src/bucketconfig/bc_cccp.cc
    src/bucketconfig/bc_file.cc
    src/bucketconfig/bc_http.cc
    src/bucketconfig/bc_static.cc
    src/bucketconfig/confmon.cc
    src/cntl.cc
    src/collections.cc
    src/connspec.cc
    src/crypto.cc
    src/defer.cc
    src/dns-srv.cc
    src/docreq/docreq.cc
    src/dump.cc
    src/errmap.cc
    src/getconfig.cc
    src/handler.cc
    src/hostlist.cc
    src/http/http.cc
    src/http/http_io.cc
    src/instance.cc
    src/iometrics.cc
    src/lcbht/lcbht.cc
    src/mcserver/mcserver.cc
    src/mcserver/negotiate.cc
    src/n1ql/ixmgmt.cc
    src/n1ql/n1ql-internal.cc
    src/n1ql/n1ql.cc
    src/n1ql/query_handle.cc
    src/n1ql/query_utils.cc
    src/newconfig.cc
    src/nodeinfo.cc
    src/operations/cbflush.cc
    src/operations/counter.cc
    src/operations/durability-seqno.cc
    src/operations/durability.cc
    src/operations/exists.cc
    src/operations/get.cc
    src/operations/get_replica.cc
    src/operations/observe-seqno.cc
    src/operations/observe.cc
    src/operations/ping.cc
    src/operations/pktfwd.cc
    src/operations/remove.cc
    src/operations/stats.cc
    src/operations/store.cc
    src/operations/subdoc.cc
    src/operations/touch.cc
    src/operations/unlock.cc
    src/retrychk.cc
    src/retryq.cc
    src/rnd.cc
    src/search/search.cc
    src/search/search_handle.cc
    src/settings.cc
    src/utilities.cc
    src/views/view.cc
    src/views/view_handle.cc
    src/wait.cc
    ${LCB_METRICS_SRC}
    ${LCB_TRACING_SRC}
    ${LCB_CAPI_SRC}
    )
