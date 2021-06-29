#pragma once
#ifndef LCBX_H
#define LCBX_H

#include <libcouchbase/couchbase.h>

enum lcbx_RESP_F {
    LCBX_RESP_F_NONFINAL = 0x01,
};

enum lcbx_SDCMD {
    LCBX_SDCMD_UNKNOWN = 0x00,
    LCBX_SDCMD_GET = 0x01,
    LCBX_SDCMD_EXISTS = 0x02,
    LCBX_SDCMD_REPLACE = 0x03,
    LCBX_SDCMD_DICT_ADD = 0x04,
    LCBX_SDCMD_DICT_UPSERT = 0x05,
    LCBX_SDCMD_ARRAY_ADD_FIRST = 0x06,
    LCBX_SDCMD_ARRAY_ADD_LAST = 0x07,
    LCBX_SDCMD_ARRAY_ADD_UNIQUE = 0x08,
    LCBX_SDCMD_ARRAY_INSERT = 0x09,
    LCBX_SDCMD_REMOVE = 0x0a,
    LCBX_SDCMD_COUNTER = 0x0b,
    LCBX_SDCMD_GET_COUNT = 0x0c,
};

enum lcbx_SDFLAG {
    LCBX_SDFLAG_UPSERT_DOC = 1 << 1,
    LCBX_SDFLAG_INSERT_DOC = 1 << 2,
    LCBX_SDFLAG_ACCESS_DELETED = 1 << 3,
};

enum lcbx_VIEWFLAG {
    LCBX_VIEWFLAG_INCLUDEDOCS = 1 << 1,
};

enum lcbx_QUERYFLAG {
    LCBX_QUERYFLAG_PREPCACHE = 1 << 1,
};

enum lcbx_ANALYTICSFLAG {
    LCBX_ANALYTICSFLAG_PRIORITY = 1 << 1,
};

enum lcbx_SERVICETYPE {
    LCBX_SERVICETYPE_KEYVALUE = 1 << 1,
    LCBX_SERVICETYPE_MANAGEMENT = 1 << 2,
    LCBX_SERVICETYPE_VIEWS = 1 << 3,
    LCBX_SERVICETYPE_QUERY = 1 << 4,
    LCBX_SERVICETYPE_SEARCH = 1 << 5,
    LCBX_SERVICETYPE_ANALYTICS = 1 << 6,
};

lcb_STATUS lcbx_cmd_create(lcb_CMDGET **cmd);
lcb_STATUS lcbx_cmd_create(lcb_CMDEXISTS **cmd);
lcb_STATUS lcbx_cmd_create(lcb_CMDGETREPLICA **cmd, lcb_REPLICA_MODE mode);
lcb_STATUS lcbx_cmd_create(lcb_CMDSTORE **cmd, lcb_STORE_OPERATION operation);
lcb_STATUS lcbx_cmd_create(lcb_CMDREMOVE **cmd);
lcb_STATUS lcbx_cmd_create(lcb_CMDTOUCH **cmd);
lcb_STATUS lcbx_cmd_create(lcb_CMDUNLOCK **cmd);
lcb_STATUS lcbx_cmd_create(lcb_CMDCOUNTER **cmd);
lcb_STATUS lcbx_cmd_create(lcb_CMDSUBDOC **cmd);
lcb_STATUS lcbx_cmd_create(lcb_SUBDOCSPECS **ops, size_t capacity);
lcb_STATUS lcbx_cmd_create(lcb_CMDVIEW **cmd);
lcb_STATUS lcbx_cmd_create(lcb_CMDQUERY **cmd);
lcb_STATUS lcbx_cmd_create(lcb_CMDANALYTICS **cmd);
lcb_STATUS lcbx_cmd_create(lcb_CMDSEARCH **cmd);
lcb_STATUS lcbx_cmd_create(lcb_CMDHTTP **cmd, lcb_HTTP_TYPE type);
lcb_STATUS lcbx_cmd_create(lcb_CMDPING **cmd);
lcb_STATUS lcbx_cmd_create(lcb_CMDDIAG **cmd);

lcb_STATUS lcbx_cmd_destroy(lcb_CMDGET *cmd);
lcb_STATUS lcbx_cmd_destroy(lcb_CMDEXISTS *cmd);
lcb_STATUS lcbx_cmd_destroy(lcb_CMDGETREPLICA *cmd);
lcb_STATUS lcbx_cmd_destroy(lcb_CMDSTORE *cmd);
lcb_STATUS lcbx_cmd_destroy(lcb_CMDREMOVE *cmd);
lcb_STATUS lcbx_cmd_destroy(lcb_CMDTOUCH *cmd);
lcb_STATUS lcbx_cmd_destroy(lcb_CMDUNLOCK *cmd);
lcb_STATUS lcbx_cmd_destroy(lcb_CMDCOUNTER *cmd);
lcb_STATUS lcbx_cmd_destroy(lcb_CMDSUBDOC *cmd);
lcb_STATUS lcbx_cmd_destroy(lcb_SUBDOCSPECS *ops);
lcb_STATUS lcbx_cmd_destroy(lcb_CMDVIEW *cmd);
lcb_STATUS lcbx_cmd_destroy(lcb_CMDQUERY *cmd);
lcb_STATUS lcbx_cmd_destroy(lcb_CMDANALYTICS *cmd);
lcb_STATUS lcbx_cmd_destroy(lcb_CMDSEARCH *cmd);
lcb_STATUS lcbx_cmd_destroy(lcb_CMDHTTP *cmd);
lcb_STATUS lcbx_cmd_destroy(lcb_CMDPING *cmd);
lcb_STATUS lcbx_cmd_destroy(lcb_CMDDIAG *cmd);

lcb_STATUS lcbx_cmd_parent_span(lcb_CMDGET *cmd, lcbtrace_SPAN *span);
lcb_STATUS lcbx_cmd_parent_span(lcb_CMDEXISTS *cmd, lcbtrace_SPAN *span);
lcb_STATUS lcbx_cmd_parent_span(lcb_CMDGETREPLICA *cmd, lcbtrace_SPAN *span);
lcb_STATUS lcbx_cmd_parent_span(lcb_CMDSTORE *cmd, lcbtrace_SPAN *span);
lcb_STATUS lcbx_cmd_parent_span(lcb_CMDREMOVE *cmd, lcbtrace_SPAN *span);
lcb_STATUS lcbx_cmd_parent_span(lcb_CMDTOUCH *cmd, lcbtrace_SPAN *span);
lcb_STATUS lcbx_cmd_parent_span(lcb_CMDUNLOCK *cmd, lcbtrace_SPAN *span);
lcb_STATUS lcbx_cmd_parent_span(lcb_CMDCOUNTER *cmd, lcbtrace_SPAN *span);
lcb_STATUS lcbx_cmd_parent_span(lcb_CMDSUBDOC *cmd, lcbtrace_SPAN *span);
lcb_STATUS lcbx_cmd_parent_span(lcb_CMDVIEW *cmd, lcbtrace_SPAN *span);
lcb_STATUS lcbx_cmd_parent_span(lcb_CMDQUERY *cmd, lcbtrace_SPAN *span);
lcb_STATUS lcbx_cmd_parent_span(lcb_CMDANALYTICS *cmd, lcbtrace_SPAN *span);
lcb_STATUS lcbx_cmd_parent_span(lcb_CMDSEARCH *cmd, lcbtrace_SPAN *span);
lcb_STATUS lcbx_cmd_parent_span(lcb_CMDHTTP *cmd, lcbtrace_SPAN *span);
lcb_STATUS lcbx_cmd_parent_span(lcb_CMDPING *cmd, lcbtrace_SPAN *span);
lcb_STATUS lcbx_cmd_parent_span(lcb_CMDDIAG *cmd, lcbtrace_SPAN *span);

#endif // LCBX_H
