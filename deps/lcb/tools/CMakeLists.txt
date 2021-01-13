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
    $<TARGET_OBJECTS:lcbtools> $<TARGET_OBJECTS:cliopts> $<TARGET_OBJECTS:lcb_jsoncpp>)
TARGET_LINK_LIBRARIES(cbc-n1qlback couchbase)

INSTALL(TARGETS cbc cbc-pillowfight cbc-n1qlback
        RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR})

IF (NOT OPENSSL_FOUND AND (NOT LCB_NO_SSL))
    FIND_PACKAGE(OpenSSL)
ENDIF()

IF(OPENSSL_FOUND AND (NOT LCB_NO_SSL))
    INCLUDE_DIRECTORIES(${OPENSSL_INCLUDE_DIR})
    ADD_DEFINITIONS(${OPENSSL_DEFINITIONS})
    TARGET_LINK_LIBRARIES(cbc ${OPENSSL_LIBRARIES})
ENDIF()

IF(MSVC)
    SET_TARGET_PROPERTIES(cbc PROPERTIES DEBUG_OUTPUT_NAME cbc_d)
    SET_TARGET_PROPERTIES(cbc-pillowfight PROPERTIES DEBUG_OUTPUT_NAME cbc-pillowfight_d)
    SET_TARGET_PROPERTIES(cbc-n1qlback PROPERTIES DEBUG_OUTPUT_NAME cbc-n1qlback_d)

    INSTALL(FILES $<TARGET_PDB_FILE:cbc> $<TARGET_PDB_FILE:cbc-pillowfight> $<TARGET_PDB_FILE:cbc-pillowfight>
            DESTINATION ${CMAKE_INSTALL_BINDIR} OPTIONAL)
ENDIF()

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

    FIND_PROGRAM(RE2C re2c)
    IF(RE2C)
        SET(CBC_GEN_LEXER_SRC "${PROJECT_SOURCE_DIR}/tools/gen/lexer.re")
        SET(CBC_GEN_LEXER_GEN "${PROJECT_SOURCE_DIR}/tools/gen/lexer.c")
        ADD_CUSTOM_COMMAND(OUTPUT ${CBC_GEN_LEXER_GEN} DEPENDS ${CBC_GEN_LEXER_SRC}
                COMMENT "RE2C tools/gen/lexer.re"
                COMMAND ${RE2C} --tags --no-debug-info --no-generation-date --output ${CBC_GEN_LEXER_GEN} ${CBC_GEN_LEXER_SRC})
    ENDIF()

    ADD_EXECUTABLE(cbc-gen cbc-gen.cc gen/lexer.c $<TARGET_OBJECTS:lcbtools> $<TARGET_OBJECTS:cliopts> $<TARGET_OBJECTS:linenoise>)
    TARGET_LINK_LIBRARIES(cbc-gen couchbase)
    INSTALL(TARGETS cbc-gen RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR})
    SET_SOURCE_FILES_PROPERTIES(cbc-gen.cc PROPERTIES COMPILE_FLAGS "${LCB_CORE_CXXFLAGS}")

    IF(HAVE_LIBEVENT2)
      INCLUDE_DIRECTORIES(AFTER ${LIBEVENT_INCLUDE_DIR})
      ADD_EXECUTABLE(cbc-proxy cbc-proxy.cc $<TARGET_OBJECTS:lcbtools> $<TARGET_OBJECTS:cliopts>)
      TARGET_LINK_LIBRARIES(cbc-proxy couchbase ${LIBEVENT_LIBRARIES})
      INSTALL(TARGETS cbc-proxy RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR})
      SET_SOURCE_FILES_PROPERTIES(cbc-proxy.cc PROPERTIES COMPILE_FLAGS "${LCB_CORE_CXXFLAGS}")
    ENDIF()

    LIST(APPEND CBC_SUBCOMMANDS
        cat create observe observe-seqno incr decr hash lock
        unlock rm stats version verbosity view n1ql admin ping
        bucket-create bucket-delete bucket-flush connstr write-config strerror
        touch role-list user-list user-upsert user-delete watch
        mcversion keygen collection-manifest collection-id
        )

    FOREACH(subcmd IN ITEMS ${CBC_SUBCOMMANDS})
        ADD_CUSTOM_COMMAND(TARGET cbc POST_BUILD
                           COMMAND ln -sf cbc "cbc-${subcmd}"
                           WORKING_DIRECTORY ${CMAKE_RUNTIME_OUTPUT_DIRECTORY}
                           COMMENT "Linking cbc -> cbc-${subcmd}")
        INSTALL(FILES ${CMAKE_RUNTIME_OUTPUT_DIRECTORY}/cbc-${subcmd}
                DESTINATION ${CMAKE_INSTALL_BINDIR})
    ENDFOREACH()
ENDIF()
