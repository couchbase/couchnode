#include "lcbx.h"

lcb_STATUS lcbx_cmd_create(lcb_CMDGET **cmd)
{
    return lcb_cmdget_create(cmd);
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

lcb_STATUS lcbx_cmd_create(lcb_SUBDOCOPS **ops, size_t capacity)
{
    return lcb_subdocops_create(ops, capacity);
}

lcb_STATUS lcbx_cmd_create(lcb_CMDVIEW **cmd)
{
    return lcb_cmdview_create(cmd);
}

lcb_STATUS lcbx_cmd_create(lcb_CMDN1QL **cmd)
{
    return lcb_cmdn1ql_create(cmd);
}

lcb_STATUS lcbx_cmd_create(lcb_CMDANALYTICS **cmd)
{
    return lcb_cmdanalytics_create(cmd);
}

lcb_STATUS lcbx_cmd_create(lcb_CMDFTS **cmd)
{
    return lcb_cmdfts_create(cmd);
}

lcb_STATUS lcbx_cmd_create(lcb_CMDHTTP **cmd, lcb_HTTP_TYPE type)
{
    return lcb_cmdhttp_create(cmd, type);
}

lcb_STATUS lcbx_cmd_destroy(lcb_CMDGET *cmd)
{
    return lcb_cmdget_destroy(cmd);
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

lcb_STATUS lcbx_cmd_destroy(lcb_SUBDOCOPS *ops)
{
    return lcb_subdocops_destroy(ops);
}

lcb_STATUS lcbx_cmd_destroy(lcb_CMDVIEW *cmd)
{
    return lcb_cmdview_destroy(cmd);
}

lcb_STATUS lcbx_cmd_destroy(lcb_CMDN1QL *cmd)
{
    return lcb_cmdn1ql_destroy(cmd);
}

lcb_STATUS lcbx_cmd_destroy(lcb_CMDANALYTICS *cmd)
{
    return lcb_cmdanalytics_destroy(cmd);
}

lcb_STATUS lcbx_cmd_destroy(lcb_CMDFTS *cmd)
{
    return lcb_cmdfts_destroy(cmd);
}

lcb_STATUS lcbx_cmd_destroy(lcb_CMDHTTP *cmd)
{
    return lcb_cmdhttp_destroy(cmd);
}
