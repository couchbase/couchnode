# This builds the examples; all these targets are optional
SET(CMAKE_RUNTIME_OUTPUT_DIRECTORY "${CMAKE_RUNTIME_OUTPUT_DIRECTORY}/examples")

MACRO(ADD_EXAMPLE name dir linkspec incspec)
    SET(dir "${CMAKE_CURRENT_SOURCE_DIR}/${dir}")
    FILE(GLOB _cur_src ${dir}/*.cc ${dir}/*.c ${dir}/*.cpp)
    ADD_EXECUTABLE(${name} ${_cur_src})
    TARGET_LINK_LIBRARIES(${name} couchbase ${linkspec})

    GET_TARGET_PROPERTY(_tmp_inc ${name} INCLUDE_DIRECTORIES)
    LIST(APPEND _tmp_inc ${incspec})
    SET_TARGET_PROPERTIES(${name} PROPERTIES INCLUDE_DIRECTORIES "${_tmp_inc}")
ENDMACRO()

# ADD_EXAMPLE(db db "" "")
ADD_EXECUTABLE(db db/db.c)
ADD_EXECUTABLE(vb db/vb.c)
TARGET_LINK_LIBRARIES(db couchbase)
TARGET_LINK_LIBRARIES(vb couchbase)

ADD_EXECUTABLE(dbx db/dbx.cc)
TARGET_LINK_LIBRARIES(dbx couchbase)

ADD_EXAMPLE(mcc mcc "" "")
ADD_EXAMPLE(views-example views "" "")
ADD_EXAMPLE(tick tick "" "")
ADD_EXAMPLE(users users "" "")
ADD_EXAMPLE(fts fts "" "")
ADD_EXAMPLE(analytics analytics "" "")
ADD_EXAMPLE(analytics-deferred analytics-deferred "" "")
ADD_EXAMPLE(analytics-ingest analytics-ingest "" "")

ADD_EXECUTABLE(tracing-zipkin tracing/tracing.c tracing/cJSON.c)
TARGET_LINK_LIBRARIES(tracing-zipkin couchbase)

find_package(Threads)
find_package(opentelemetry-cpp CONFIG)
if(TARGET opentelemetry-cpp::trace)
    ADD_EXECUTABLE(otel_tracing tracing/otel_tracing.cc)
    TARGET_LINK_LIBRARIES(otel_tracing
            ${CMAKE_THREAD_LIBS_INIT}
            opentelemetry-cpp::ostream_span_exporter
            opentelemetry-cpp::trace
            couchbase)
    TARGET_INCLUDE_DIRECTORIES(otel_tracing PUBLIC ${OPENTELEMETRY_CPP_INCLUDE_DIRS})
else()
    MESSAGE(STATUS "Not building otel_tracing as opentelemetry::trace target is not found")
endif()

if(TARGET opentelemetry-cpp::metrics)
    ADD_EXECUTABLE(otel_metrics metrics/otel_metrics.cc)
    TARGET_LINK_LIBRARIES(otel_metrics
            ${CMAKE_THREAD_LIBS_INIT}
            couchbase
            opentelemetry-cpp::metrics
            opentelemetry-cpp::ostream_metrics_exporter)
    TARGET_INCLUDE_DIRECTORIES(otel_metrics PUBLIC ${OPENTELEMETRY_CPP_INCLUDE_DIRS})
    TARGET_COMPILE_OPTIONS(otel_metrics PUBLIC -DENABLE_METRICS_PREVIEW)
else()
    MESSAGE(STATUS "Not building otel_metrics as opentelemetry::metrics target is not found")
endif()

ADD_EXECUTABLE(tracing-views tracing/views.c tracing/cJSON.c)
TARGET_LINK_LIBRARIES(tracing-views couchbase)

ADD_EXECUTABLE(subdoc-simple subdoc/subdoc-simple.cc)
ADD_EXECUTABLE(subdoc-tombstone subdoc/subdoc-tombstone.cc)
ADD_EXECUTABLE(subdoc-multi subdoc/subdoc-multi.cc)
ADD_EXECUTABLE(subdoc-xattrs subdoc/subdoc-xattrs.c)
TARGET_LINK_LIBRARIES(subdoc-simple couchbase)
TARGET_LINK_LIBRARIES(subdoc-tombstone couchbase)
TARGET_LINK_LIBRARIES(subdoc-multi couchbase)
TARGET_LINK_LIBRARIES(subdoc-xattrs couchbase)

ADD_EXECUTABLE(durability minimal/durability.cc)
TARGET_LINK_LIBRARIES(durability couchbase)

ADD_EXECUTABLE(minimal minimal/minimal.c)
TARGET_LINK_LIBRARIES(minimal couchbase)

ADD_EXECUTABLE(query minimal/query.c)
TARGET_LINK_LIBRARIES(query couchbase)

ADD_EXECUTABLE(logger minimal/logger.c minimal/cJSON.c)
TARGET_LINK_LIBRARIES(logger couchbase)

ADD_EXECUTABLE(g3cp minimal/g3cp.c)
TARGET_LINK_LIBRARIES(g3cp couchbase)

ADD_EXECUTABLE(g3cp-async minimal/g3cp-async.c)
TARGET_LINK_LIBRARIES(g3cp-async couchbase)

ADD_EXECUTABLE(management-eventing management/eventing.cc)
TARGET_LINK_LIBRARIES(management-eventing couchbase)

IF(NOT WIN32)
    ADD_EXAMPLE(instancepool instancepool pthread "")
ENDIF()
IF(HAVE_LIBEVENT2)
    ADD_EXAMPLE(libevent-direct libeventdirect ${LIBEVENT_LIBRARIES} ${LIBEVENT_INCLUDE_DIR})
ENDIF()

IF(HAVE_LIBUV AND LCB_BUILD_LIBUV)
    ADD_EXAMPLE(libuv-direct libuvdirect ${LIBUV_LIBRARIES} ${LIBUV_INCLUDE_DIR})
ENDIF()
