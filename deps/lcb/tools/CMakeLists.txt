CMAKE_MINIMUM_REQUIRED(VERSION 2.8)
INCLUDE_DIRECTORIES(${SOURCE_ROOT}/contrib/cliopts)
FILE(GLOB T_COMMONSRC common/*.cc)
ADD_LIBRARY(lcbtools OBJECT ${T_COMMONSRC})

ADD_EXECUTABLE(cbc cbc.cc
    $<TARGET_OBJECTS:lcbtools> $<TARGET_OBJECTS:cliopts> $<TARGET_OBJECTS:lcb_jsoncpp>)
TARGET_LINK_LIBRARIES(cbc couchbase)

ADD_EXECUTABLE(cbc-pillowfight cbc-pillowfight.cc
    $<TARGET_OBJECTS:lcbtools> $<TARGET_OBJECTS:cliopts> $<TARGET_OBJECTS:lcb_jsoncpp>)

TARGET_LINK_LIBRARIES(cbc-pillowfight couchbase)

ADD_EXECUTABLE(cbc-n1qlback cbc-n1qlback.cc
    $<TARGET_OBJECTS:lcbtools> $<TARGET_OBJECTS:cliopts>)
TARGET_LINK_LIBRARIES(cbc-n1qlback couchbase)

INSTALL(TARGETS cbc cbc-pillowfight cbc-n1qlback
        RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR})

FIND_PACKAGE(OpenSSL)
IF(OPENSSL_FOUND AND (NOT LCB_NO_SSL))
    INCLUDE_DIRECTORIES(${OPENSSL_INCLUDE_DIR})
    ADD_DEFINITIONS(${OPENSSL_DEFINITIONS})
    TARGET_LINK_LIBRARIES(cbc ${OPENSSL_LIBRARIES})
ENDIF()

# Set this before INSTALL_PDBS in order to set the correct output name
IF(MSVC)
    SET_TARGET_PROPERTIES(cbc PROPERTIES DEBUG_OUTPUT_NAME cbc_d)
    SET_TARGET_PROPERTIES(cbc-pillowfight PROPERTIES DEBUG_OUTPUT_NAME cbc-pillowfight_d)
    SET_TARGET_PROPERTIES(cbc-n1qlback PROPERTIES DEBUG_OUTPUT_NAME cbc-n1qlback_d)
ENDIF()

INSTALL_PDBS(cbc)
INSTALL_PDBS(cbc-pillowfight)
INSTALL_PDBS(cbc-n1qlback)

SET_TARGET_PROPERTIES(lcbtools PROPERTIES COMPILE_FLAGS "${LCB_CORE_CXXFLAGS}")
SET_SOURCE_FILES_PROPERTIES(cbc.cc cbc-pillowfight.cc cbc-n1qlback.cc PROPERTIES COMPILE_FLAGS "${LCB_CORE_CXXFLAGS}")

IF(NOT WIN32)
    FILE(GLOB T_LINENOSE_SRC linenoise/*.c)
    ADD_LIBRARY(linenoise OBJECT ${T_LINENOSE_SRC})
    SET_TARGET_PROPERTIES(linenoise PROPERTIES COMPILE_FLAGS "${LCB_CORE_CFLAGS}")

    ADD_EXECUTABLE(cbc-subdoc cbc-subdoc.cc $<TARGET_OBJECTS:lcbtools> $<TARGET_OBJECTS:cliopts> $<TARGET_OBJECTS:linenoise>)
    TARGET_LINK_LIBRARIES(cbc-subdoc couchbase)
    INSTALL(TARGETS cbc-subdoc RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR})
    SET_SOURCE_FILES_PROPERTIES(cbc-subdoc.cc PROPERTIES COMPILE_FLAGS "${LCB_CORE_CXXFLAGS}")

    IF(HAVE_LIBEVENT2)
      INCLUDE_DIRECTORIES(AFTER ${LIBEVENT_INCLUDE_DIR})
      ADD_EXECUTABLE(cbc-proxy cbc-proxy.cc $<TARGET_OBJECTS:lcbtools> $<TARGET_OBJECTS:cliopts>)
      TARGET_LINK_LIBRARIES(cbc-proxy couchbase ${LIBEVENT_LIBRARIES})
      INSTALL(TARGETS cbc-proxy RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR})
      SET_SOURCE_FILES_PROPERTIES(cbc-proxy.cc PROPERTIES COMPILE_FLAGS "${LCB_CORE_CXXFLAGS}")
    ENDIF()

    LIST(APPEND CBC_SUBCOMMANDS
        cat create observe observe-seqno incr decr mcflush hash lock
        unlock rm stats version verbosity view n1ql admin ping
        bucket-create bucket-delete bucket-flush connstr write-config strerror
        touch role-list user-list user-upsert user-delete watch)

    FOREACH(subcmd IN ITEMS ${CBC_SUBCOMMANDS})
        ADD_CUSTOM_COMMAND(TARGET cbc POST_BUILD
                           COMMAND ln -sf cbc "cbc-${subcmd}"
                           WORKING_DIRECTORY ${CMAKE_RUNTIME_OUTPUT_DIRECTORY}
                           COMMENT "Linking cbc -> cbc-${subcmd}")
        INSTALL(FILES ${CMAKE_RUNTIME_OUTPUT_DIRECTORY}/cbc-${subcmd}
                DESTINATION ${CMAKE_INSTALL_BINDIR})
    ENDFOREACH()
ENDIF()
