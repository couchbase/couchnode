CMAKE_MINIMUM_REQUIRED(VERSION 2.8)
INCLUDE_DIRECTORIES(${SOURCE_ROOT}/contrib/cliopts)
FILE(GLOB T_COMMONSRC common/*.cc)
ADD_LIBRARY(lcbtools OBJECT ${T_COMMONSRC})

ADD_EXECUTABLE(cbc cbc.cc
    $<TARGET_OBJECTS:lcbtools> $<TARGET_OBJECTS:cliopts>)
TARGET_LINK_LIBRARIES(cbc couchbase)

ADD_EXECUTABLE(cbc-pillowfight cbc-pillowfight.cc
    $<TARGET_OBJECTS:lcbtools> $<TARGET_OBJECTS:cliopts>)

TARGET_LINK_LIBRARIES(cbc-pillowfight couchbase)

INSTALL(TARGETS cbc cbc-pillowfight RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR})

# Set this before INSTALL_PDBS in order to set the correct output name
IF(MSVC)
    SET_TARGET_PROPERTIES(cbc PROPERTIES DEBUG_OUTPUT_NAME cbc_d)
    SET_TARGET_PROPERTIES(cbc-pillowfight PROPERTIES DEBUG_OUTPUT_NAME cbc-pillowfight_d)
ENDIF()

INSTALL_PDBS(cbc)
INSTALL_PDBS(cbc-pillowfight)

SET_TARGET_PROPERTIES(lcbtools PROPERTIES COMPILE_FLAGS "${LCB_CORE_CXXFLAGS}")
SET_SOURCE_FILES_PROPERTIES(cbc.cc cbc-pillowfight.cc PROPERTIES COMPILE_FLAGS "${LCB_CORE_CXXFLAGS}")

IF(NOT WIN32)
    LIST(APPEND CBC_SUBCOMMANDS
        admin bucket-create bucket-delete cat cp create decr hash incr lock mcflush
        rm stats unlock verbosity verify version verbosity view)
    FOREACH(subcmd IN ITEMS ${CBC_SUBCOMMANDS})
        ADD_CUSTOM_COMMAND(TARGET cbc POST_BUILD
                           COMMAND ln -sf cbc "cbc-${subcmd}"
                           WORKING_DIRECTORY ${CMAKE_RUNTIME_OUTPUT_DIRECTORY}
                           COMMENT "Linking cbc -> cbc-${subcmd}")
        INSTALL(FILES ${CMAKE_RUNTIME_OUTPUT_DIRECTORY}/cbc-${subcmd}
                DESTINATION ${CMAKE_INSTALL_BINDIR})
    ENDFOREACH()
ENDIF()
