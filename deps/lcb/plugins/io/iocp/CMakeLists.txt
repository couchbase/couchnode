IF(WIN32)
    ADD_LIBRARY(couchbase_iocp STATIC
        iocp_iops.c
        iocp_loop.c
        iocp_timer.c
        iocp_util.c)
    ADD_DEFINITIONS(-DLIBCOUCHBASE_INTERNAL=1)
ENDIF(WIN32)
