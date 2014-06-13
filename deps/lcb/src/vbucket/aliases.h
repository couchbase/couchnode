#ifndef VB_ALIASES_H
#define VB_ALIASES_H

#define VB_NODESTR(config, index) lcbvb_get_hostport(config, index, LCBVB_SVCTYPE_DATA, LCBVB_SVCMODE_PLAIN)
#define VB_RESTURL(config, index) lcbvb_get_hostport(config, index, LCBVB_SVCTYPE_MGMT, LCBVB_SVCMODE_PLAIN)
#define VB_VIEWSURL(config, index) lcbvb_get_capibase(config, index, LCBVB_SVCMODE_PLAIN)
#define VB_SSLNODESTR(config, index) lcbvb_get_hostport(config, index, LCBVB_SVCTYPE_DATA, LCBVB_SVCMODE_SSL)
#define VB_SSLRESTURL(config, index) lcbvb_get_hostport(config, index, LCBVB_SVCTYPE_MGMT, LCBVB_SVCMODE_SSL)
#define VB_SSLVIEWSURL(config, index) lcbvb_get_capibase(config, index, LCBVB_SVCMODE_SSL)
#define VB_MEMDSTR(config, index, mode) lcbvb_get_hostport(config, index, LCBVB_SVCTYPE_DATA, mode)
#define VB_MGMTSTR(config, index, mode) lcbvb_get_hostport(config, index, LCBVB_SVCTYPE_MGMT, mode)
#define VB_CAPIURL(config, index, mode) lcbvb_get_capibase(config, index, mode)

#define VB_DISTTYPE(config) (config)->dtype
#define VB_NREPLICAS(config) (config)->nrepl
#define VB_NSERVERS(config) (config)->nsrv

#endif
