CMAKE_MINIMUM_REQUIRED(VERSION 2.8)
ADD_EXECUTABLE(cbc
    cbc-util.cc
    cbc.cc
    commandlineparser.cc
    configuration.cc)

SET_PROPERTY(TARGET cbc
    PROPERTY DEBUG_OUTPUT_NAME "cbc_d")

TARGET_LINK_LIBRARIES(cbc couchbase)

ADD_EXECUTABLE(cbc-pillowfight
    cbc-pillowfight.cc
    commandlineparser.cc)

SET_PROPERTY(TARGET cbc-pillowfight
    PROPERTY DEBUG_OUTPUT_NAME "cbc-pillowfight_d")

TARGET_LINK_LIBRARIES(cbc-pillowfight couchbase)

INSTALL(TARGETS cbc cbc-pillowfight RUNTIME
    DESTINATION bin)
INSTALL_PDBS(cbc)
INSTALL_PDBS(cbc-pillowfight)
