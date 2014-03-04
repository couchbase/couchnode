ADD_LIBRARY(vbucket STATIC
    cJSON.c
    vbucket.c
    ketama.c
    crc32.c)
SET_TARGET_PROPERTIES(vbucket
    PROPERTIES
        POSITION_INDEPENDENT_CODE TRUE)
