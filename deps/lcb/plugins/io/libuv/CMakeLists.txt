INSTALL(
    FILES
    plugin-libuv.c
    plugin-internal.h
    DESTINATION
    include/libcouchbase/plugins/io/libuv)

INSTALL(
    FILES
    libuv_io_opts.h
    DESTINATION
    include/libcouchbase)

IF(NOT HAVE_LIBUV)
    RETURN()
ENDIF()

ADD_LIBRARY(couchbase_libuv SHARED plugin-libuv.c)
SET_TARGET_PROPERTIES(couchbase_libuv
    PROPERTIES
    PREFIX "lib"
    IMPORT_PREFIX "lib")

TARGET_LINK_LIBRARIES(couchbase_libuv ${LIBUV_LIBRARIES} couchbase)
INCLUDE_DIRECTORIES(AFTER ${LIBUV_INCLUDE_DIR})
ADD_DEFINITIONS(-DLIBCOUCHBASE_INTERNAL=1)
INSTALL(TARGETS
    couchbase_libuv
    LIBRARY DESTINATION lib
    RUNTIME DESTINATION bin)
