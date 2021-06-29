#include "lcbx.h"

lcb_STATUS lcbx_cmd_create(lcb_CMDGET **cmd)
{
    return lcb_cmdget_create(cmd);
}

lcb_STATUS lcbx_cmd_create(lcb_CMDEXISTS **cmd)
{
    return lcb_cmdexists_create(cmd);
}

lcb_STATUS lcbx_cmd_create(lcb_CMDGETREPLICA **cmd, lcb_REPLICA_MODE mode)
{
    return lcb_cmdgetreplica_create(cmd, mode);
}

lcb_STATUS lcbx_cmd_create(lcb_CMDSTORE **cmd, lcb_STORE_OPERATION operation)
{
    return lcb_cmdstore_create(cmd, operation);
}

lcb_STATUS lcbx_cmd_create(lcb_CMDREMOVE **cmd)
{
    return lcb_cmdremove_create(cmd);
}

lcb_STATUS lcbx_cmd_create(lcb_CMDTOUCH **cmd)
{
    return lcb_cmdtouch_create(cmd);
}

lcb_STATUS lcbx_cmd_create(lcb_CMDUNLOCK **cmd)
{
    return lcb_cmdunlock_create(cmd);
}

lcb_STATUS lcbx_cmd_create(lcb_CMDCOUNTER **cmd)
{
    return lcb_cmdcounter_create(cmd);
}

lcb_STATUS lcbx_cmd_create(lcb_CMDSUBDOC **cmd)
{
    return lcb_cmdsubdoc_create(cmd);
}

lcb_STATUS lcbx_cmd_create(lcb_SUBDOCSPECS **ops, size_t capacity)
{
    return lcb_subdocspecs_create(ops, capacity);
}

lcb_STATUS lcbx_cmd_create(lcb_CMDVIEW **cmd)
{
    return lcb_cmdview_create(cmd);
}

lcb_STATUS lcbx_cmd_create(lcb_CMDQUERY **cmd)
{
    return lcb_cmdquery_create(cmd);
}

lcb_STATUS lcbx_cmd_create(lcb_CMDANALYTICS **cmd)
{
    return lcb_cmdanalytics_create(cmd);
}

lcb_STATUS lcbx_cmd_create(lcb_CMDSEARCH **cmd)
{
    return lcb_cmdsearch_create(cmd);
}

lcb_STATUS lcbx_cmd_create(lcb_CMDHTTP **cmd, lcb_HTTP_TYPE type)
{
    return lcb_cmdhttp_create(cmd, type);
}

lcb_STATUS lcbx_cmd_create(lcb_CMDPING **cmd)
{
    return lcb_cmdping_create(cmd);
}

lcb_STATUS lcbx_cmd_create(lcb_CMDDIAG **cmd)
{
    return lcb_cmddiag_create(cmd);
}

lcb_STATUS lcbx_cmd_destroy(lcb_CMDGET *cmd)
{
    return lcb_cmdget_destroy(cmd);
}

lcb_STATUS lcbx_cmd_destroy(lcb_CMDEXISTS *cmd)
{
    return lcb_cmdexists_destroy(cmd);
}

lcb_STATUS lcbx_cmd_destroy(lcb_CMDGETREPLICA *cmd)
{
    return lcb_cmdgetreplica_destroy(cmd);
}

lcb_STATUS lcbx_cmd_destroy(lcb_CMDSTORE *cmd)
{
    return lcb_cmdstore_destroy(cmd);
}

lcb_STATUS lcbx_cmd_destroy(lcb_CMDREMOVE *cmd)
{
    return lcb_cmdremove_destroy(cmd);
}

lcb_STATUS lcbx_cmd_destroy(lcb_CMDTOUCH *cmd)
{
    return lcb_cmdtouch_destroy(cmd);
}

lcb_STATUS lcbx_cmd_destroy(lcb_CMDUNLOCK *cmd)
{
    return lcb_cmdunlock_destroy(cmd);
}

lcb_STATUS lcbx_cmd_destroy(lcb_CMDCOUNTER *cmd)
{
    return lcb_cmdcounter_destroy(cmd);
}

lcb_STATUS lcbx_cmd_destroy(lcb_CMDSUBDOC *cmd)
{
    return lcb_cmdsubdoc_destroy(cmd);
}

lcb_STATUS lcbx_cmd_destroy(lcb_SUBDOCSPECS *ops)
{
    return lcb_subdocspecs_destroy(ops);
}

lcb_STATUS lcbx_cmd_destroy(lcb_CMDVIEW *cmd)
{
    return lcb_cmdview_destroy(cmd);
}

lcb_STATUS lcbx_cmd_destroy(lcb_CMDQUERY *cmd)
{
    return lcb_cmdquery_destroy(cmd);
}

lcb_STATUS lcbx_cmd_destroy(lcb_CMDANALYTICS *cmd)
{
    return lcb_cmdanalytics_destroy(cmd);
}

lcb_STATUS lcbx_cmd_destroy(lcb_CMDSEARCH *cmd)
{
    return lcb_cmdsearch_destroy(cmd);
}

lcb_STATUS lcbx_cmd_destroy(lcb_CMDHTTP *cmd)
{
    return lcb_cmdhttp_destroy(cmd);
}

lcb_STATUS lcbx_cmd_destroy(lcb_CMDPING *cmd)
{
    return lcb_cmdping_destroy(cmd);
}

lcb_STATUS lcbx_cmd_destroy(lcb_CMDDIAG *cmd)
{
    return lcb_cmddiag_destroy(cmd);
}

lcb_STATUS lcbx_cmd_parent_span(lcb_CMDGET *cmd, lcbtrace_SPAN *span)
{
    return lcb_cmdget_parent_span(cmd, span);
}

lcb_STATUS lcbx_cmd_parent_span(lcb_CMDEXISTS *cmd, lcbtrace_SPAN *span)
{
    return lcb_cmdexists_parent_span(cmd, span);
}

lcb_STATUS lcbx_cmd_parent_span(lcb_CMDGETREPLICA *cmd, lcbtrace_SPAN *span)
{
    return lcb_cmdgetreplica_parent_span(cmd, span);
}

lcb_STATUS lcbx_cmd_parent_span(lcb_CMDSTORE *cmd, lcbtrace_SPAN *span)
{
    return lcb_cmdstore_parent_span(cmd, span);
}

lcb_STATUS lcbx_cmd_parent_span(lcb_CMDREMOVE *cmd, lcbtrace_SPAN *span)
{
    return lcb_cmdremove_parent_span(cmd, span);
}

lcb_STATUS lcbx_cmd_parent_span(lcb_CMDTOUCH *cmd, lcbtrace_SPAN *span)
{
    return lcb_cmdtouch_parent_span(cmd, span);
}

lcb_STATUS lcbx_cmd_parent_span(lcb_CMDUNLOCK *cmd, lcbtrace_SPAN *span)
{
    return lcb_cmdunlock_parent_span(cmd, span);
}

lcb_STATUS lcbx_cmd_parent_span(lcb_CMDCOUNTER *cmd, lcbtrace_SPAN *span)
{
    return lcb_cmdcounter_parent_span(cmd, span);
}

lcb_STATUS lcbx_cmd_parent_span(lcb_CMDSUBDOC *cmd, lcbtrace_SPAN *span)
{
    return lcb_cmdsubdoc_parent_span(cmd, span);
}

lcb_STATUS lcbx_cmd_parent_span(lcb_CMDVIEW *cmd, lcbtrace_SPAN *span)
{
    return lcb_cmdview_parent_span(cmd, span);
}

lcb_STATUS lcbx_cmd_parent_span(lcb_CMDQUERY *cmd, lcbtrace_SPAN *span)
{
    return lcb_cmdquery_parent_span(cmd, span);
}

lcb_STATUS lcbx_cmd_parent_span(lcb_CMDANALYTICS *cmd, lcbtrace_SPAN *span)
{
    return lcb_cmdanalytics_parent_span(cmd, span);
}

lcb_STATUS lcbx_cmd_parent_span(lcb_CMDSEARCH *cmd, lcbtrace_SPAN *span)
{
    return lcb_cmdsearch_parent_span(cmd, span);
}

lcb_STATUS lcbx_cmd_parent_span(lcb_CMDHTTP *cmd, lcbtrace_SPAN *span)
{
    return lcb_cmdhttp_parent_span(cmd, span);
}

lcb_STATUS lcbx_cmd_parent_span(lcb_CMDPING *cmd, lcbtrace_SPAN *span)
{
    return lcb_cmdping_parent_span(cmd, span);
}

lcb_STATUS lcbx_cmd_parent_span(lcb_CMDDIAG *cmd, lcbtrace_SPAN *span)
{
    return LCB_ERR_UNSUPPORTED_OPERATION;
}
