ADD_LIBRARY(vbucket OBJECT vbucket.c ketama.c ${SOURCE_ROOT}/contrib/cJSON/cJSON.c)
LCB_UTIL(vbucket)
