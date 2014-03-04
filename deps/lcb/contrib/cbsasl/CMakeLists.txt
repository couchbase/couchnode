ADD_DEFINITIONS(-DBUILDING_CBSASL=1)
INCLUDE_DIRECTORIES(src)

ADD_LIBRARY(cbsasl STATIC
    src/client.c
    src/common.c
    src/cram-md5/hmac.c
    src/cram-md5/hmac.h
    src/cram-md5/md5.c)

SET_TARGET_PROPERTIES(cbsasl
    PROPERTIES
        POSITION_INDEPENDENT_CODE TRUE)
