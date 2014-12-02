# This module will help find/locate gtest on various platforms
IF(GTEST_ROOT)
    RETURN()
    #define already
ENDIF()

IF(EXISTS /usr/src/gtest AND NOT WIN32)
    SET(GTEST_ROOT /usr/src/gtest)
    RETURN()
    # If 'libgtest-dev' is installed
ENDIF()

IF(NOT EXISTS ${GTEST_ZIP_PATH})
    MESSAGE(STATUS "${GTEST_ARCHIVE} not found. Downloading")
    DOWNLOAD_LCB_DEP("${GTEST_DLSERVER}/${GTEST_ARCHIVE}" "${GTEST_ZIP_PATH}")
    IF(UNIX)
        EXECUTE_PROCESS(COMMAND unzip "${GTEST_ZIP_PATH}" WORKING_DIRECTORY ${SOURCE_ROOT})
    ELSE()
        EXECUTE_PROCESS(COMMAND cmake -E tar xf ${GTEST_ARCHIVE} WORKING_DIRECTORY ${SOURCE_ROOT})
    ENDIF()
ENDIF(NOT EXISTS ${GTEST_ZIP_PATH})
SET(GTEST_ROOT ${SOURCE_ROOT}/gtest-1.7.0)
