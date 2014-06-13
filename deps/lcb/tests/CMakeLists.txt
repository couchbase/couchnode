SET(GTEST_ZIP_PATH ${SOURCE_ROOT}/${GTEST_ARCHIVE})
IF(NOT EXISTS ${GTEST_ZIP_PATH})
    MESSAGE(STATUS "${GTEST_ARCHIVE} not found. Downloading")
    IF(UNIX)
        EXECUTE_PROCESS(
            COMMAND
                wget -O "${GTEST_ZIP_PATH}" "${GTEST_DLSERVER}/${GTEST_ARCHIVE}")
        EXECUTE_PROCESS(
            COMMAND
                unzip "${GTEST_ZIP_PATH}"
            WORKING_DIRECTORY
                ${SOURCE_ROOT})
    ELSE()
        FILE(DOWNLOAD ${GTEST_DLSERVER}/${GTEST_ARCHIVE}
            ${SOURCE_ROOT}/${GTEST_ARCHIVE})
        EXECUTE_PROCESS(
            COMMAND cmake -E tar xf ${GTEST_ARCHIVE}
            WORKING_DIRECTORY ${SOURCE_ROOT})
    ENDIF()
ENDIF(NOT EXISTS ${GTEST_ZIP_PATH})

SET(gtest_force_shared_crt ON CACHE BOOL "" )
SET(BUILD_SHARED_LIBS ON)
ADD_SUBDIRECTORY(${SOURCE_ROOT}/gtest-1.7.0 gtest-1.7.0)
INCLUDE_DIRECTORIES(${CMAKE_CURRENT_SOURCE_DIR})

ADD_EXECUTABLE(check-all EXCLUDE_FROM_ALL
    check-all.cc ${SOURCE_ROOT}/contrib/cliopts/cliopts.c mocksupport/procutil.c)

SET_PROPERTY(TARGET check-all
    APPEND PROPERTY INCLUDE_DIRECTORIES
    ${lcb_plat_includes}
    ${SOURCE_ROOT})
TARGET_LINK_LIBRARIES(check-all couchbase_utils couchbase)


FILE(GLOB T_BASIC_SRC basic/*.cc)
FILE(GLOB T_MC_SRC mc/*.cc)
FILE(GLOB T_RDB_SRC rdb/*.cc)
FILE(GLOB T_SOCK_SRC socktests/*.cc)
FILE(GLOB T_IOSERVER_SRC ioserver/*.cc)
FILE(GLOB T_MOCKSUPPORT_SRC mocksupport/*.c mocksupport/*.cc)
FILE(GLOB T_VBTEST_SRC vbucket/*.cc)

ADD_LIBRARY(ioserver STATIC EXCLUDE_FROM_ALL ${T_IOSERVER_SRC})
ADD_LIBRARY(mocksupport STATIC EXCLUDE_FROM_ALL ${T_MOCKSUPPORT_SRC})
ADD_EXECUTABLE(nonio-tests EXCLUDE_FROM_ALL nonio_tests.cc ${T_BASIC_SRC})
ADD_EXECUTABLE(mc-tests EXCLUDE_FROM_ALL mc_tests.cc ${T_MC_SRC})
ADD_EXECUTABLE(mc-malloc-tests EXCLUDE_FROM_ALL mc_tests.cc ${T_MC_SRC})
ADD_EXECUTABLE(netbuf-tests EXCLUDE_FROM_ALL nonio_tests.cc basic/t_netbuf.cc)
ADD_EXECUTABLE(rdb-tests EXCLUDE_FROM_ALL nonio_tests.cc
    ${T_RDB_SRC} ${SOURCE_ROOT}/src/list.c)
ADD_EXECUTABLE(sock-tests EXCLUDE_FROM_ALL nonio_tests.cc ${T_SOCK_SRC})
ADD_EXECUTABLE(vbucket-tests EXCLUDE_FROM_ALL nonio_tests.cc ${T_VBTEST_SRC})
ADD_EXECUTABLE(htparse-tests EXCLUDE_FROM_ALL nonio_tests.cc htparse/t_basic.cc ${SOURCE_ROOT}/src/lcbht/lcbht.c)
IF(WIN32)
    TARGET_LINK_LIBRARIES(mc-tests ws2_32.lib)
    TARGET_LINK_LIBRARIES(mc-malloc-tests ws2_32.lib)
    TARGET_LINK_LIBRARIES(sock-tests ws2_32.lib)
ENDIF()


FILE(GLOB T_IO_SRC iotests/*.cc)
ADD_EXECUTABLE(unit-tests EXCLUDE_FROM_ALL ${T_IO_SRC} unit_tests.cc)

# Normally defined by config.h
SET_PROPERTY(
    TARGET unit-tests
    APPEND PROPERTY COMPILE_DEFINITIONS
    BUILD_PLUGINS
    )

IF(CMAKE_COMPILER_IS_GNUCXX)
    SET_TARGET_PROPERTIES(unit-tests
        PROPERTIES
        COMPILE_FLAGS "-Wno-sign-compare -Wno-missing-field-initializers")
ENDIF(CMAKE_COMPILER_IS_GNUCXX)



IF(NOT EXISTS ${CMAKE_SOURCE_DIR}/tests/CouchbaseMock.jar)
    file(DOWNLOAD ${COUCHBASE_MOCK_DLSERVER}/${COUCHBASE_MOCK_VERSION}
        ${CMAKE_SOURCE_DIR}/tests/CouchbaseMock.jar)
ENDIF(NOT EXISTS ${CMAKE_SOURCE_DIR}/tests/CouchbaseMock.jar)

# We're a library using the shared CRT. Don't use the static one
INCLUDE_DIRECTORIES(${gtest_SOURCE_DIR}/include ${gtest_SOURCE_DIR})
TARGET_LINK_LIBRARIES(unit-tests couchbase couchbase_utils gtest mocksupport)
TARGET_LINK_LIBRARIES(nonio-tests couchbase couchbase_utils netbuf gtest)
TARGET_LINK_LIBRARIES(mc-tests mcreq netbuf vbucket gtest couchbase_utils ${LCB_SNAPPY_LINK})
TARGET_LINK_LIBRARIES(mc-malloc-tests mcreq netbuf-malloc vbucket gtest ${LCB_SNAPPY_LINK})
TARGET_LINK_LIBRARIES(netbuf-tests netbuf gtest)
TARGET_LINK_LIBRARIES(rdb-tests rdb gtest)
TARGET_LINK_LIBRARIES(sock-tests rdb ioserver couchbase gtest)
TARGET_LINK_LIBRARIES(vbucket-tests gtest couchbase)
TARGET_LINK_LIBRARIES(htparse-tests gtest couchbase lcbht)

MACRO(BUILD_TEST target)
    ADD_TEST(NAME BUILD-${target}
        COMMAND ${CMAKE_COMMAND} --build "${CMAKE_BINARY_DIR}" --target ${target})
ENDMACRO()

BUILD_TEST(check-all)
BUILD_TEST(unit-tests)
BUILD_TEST(nonio-tests)
BUILD_TEST(rdb-tests)
BUILD_TEST(sock-tests)
BUILD_TEST(vbucket-tests)
BUILD_TEST(mc-tests)
BUILD_TEST(htparse-tests)

ADD_CUSTOM_TARGET(alltests DEPENDS check-all unit-tests nonio-tests
    rdb-tests sock-tests vbucket-tests mc-tests htparse-tests)

MACRO(DEFINE_MOCKTEST plugin test)
    ADD_TEST(
        NAME
            check-${plugin}-${test}
        COMMAND
            $<TARGET_FILE:check-all>
            --srcdir "${CMAKE_SOURCE_DIR}"
            --testdir "$<TARGET_FILE_DIR:check-all>"
            --libdir "$<TARGET_FILE_DIR:couchbase>"
            --plugins ${plugin}
            --tests ${test}
            --verbose
            --
            --gtest_print_time=1
            --gtest_output=xml:"${CMAKE_BINARY_DIR}/REPORT_${plugin}_${test}.xml")
ENDMACRO()

# Since we need a plugin name, we'll use 'select'. However none of these
# actually do any I/O
DEFINE_MOCKTEST("select" "nonio-tests")
DEFINE_MOCKTEST("select" "rdb-tests")
DEFINE_MOCKTEST("select" "vbucket-tests")
DEFINE_MOCKTEST("select" "mc-tests")
DEFINE_MOCKTEST("select" "htparse-tests")


DEFINE_MOCKTEST("select" "unit-tests")
DEFINE_MOCKTEST("select" "sock-tests")
IF(WIN32)
    DEFINE_MOCKTEST("iocp" "unit-tests")
    DEFINE_MOCKTEST("iocp" "sock-tests")
ENDIF()
IF(HAVE_LIBEVENT)
    DEFINE_MOCKTEST("libevent" "unit-tests")
    DEFINE_MOCKTEST("libevent" "sock-tests")
ENDIF()
IF(HAVE_LIBEV)
    DEFINE_MOCKTEST("libev" "unit-tests")
    DEFINE_MOCKTEST("libev" "sock-tests")
ENDIF()
IF(HAVE_LIBUV)
    DEFINE_MOCKTEST("libuv" "unit-tests")
    DEFINE_MOCKTEST("libuv" "sock-tests")
ENDIF()
