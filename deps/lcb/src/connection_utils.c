#include "internal.h"
#include "hostlist.h"
#include "logging.h"

#define LOGARGS(conn, lvl) \
    conn->settings, "conncycle", LCB_LOG_##lvl, __FILE__, __LINE__

#define LOG(conn, lvl, msg) lcb_log(LOGARGS(conn, lvl), msg)

lcb_error_t lcb_connection_next_node(lcb_connection_t conn,
                                     hostlist_t hostlist,
                                     lcb_conn_params *params,
                                     char **errinfo)
{
    lcb_host_t *next_host = NULL;
    lcb_connection_close(conn);

    while ( (next_host = hostlist_shift_next(hostlist, 0))) {
        lcb_connection_result_t connres;
        params->destination = next_host;
        connres = lcb_connection_start(conn, params, LCB_CONNSTART_NOCB);

        if (connres != LCB_CONN_INPROGRESS) {
            lcb_connection_close(conn);
        }

        return LCB_SUCCESS;
    }

    *errinfo = "No valid hosts remain";
    return LCB_CONNECT_ERROR;
}

lcb_error_t lcb_connection_cycle_nodes(lcb_connection_t conn,
                                        hostlist_t hostlist,
                                        lcb_conn_params *params,
                                        char **errinfo)
{
    lcb_size_t total = hostlist->nentries;
    lcb_size_t ii;

    for (ii = 0; ii < total; ii++) {
        lcb_connection_result_t connres;
        params->destination = hostlist_shift_next(hostlist, 1);
        lcb_assert(params->destination != NULL);

        connres = lcb_connection_start(conn, params, LCB_CONNSTART_NOCB);
        if (connres != LCB_CONN_INPROGRESS) {
            LOG(conn, ERR, "Couldn't start connection");
            lcb_connection_close(conn);
        } else {
            return LCB_SUCCESS;
        }
    }

    LOG(conn, ERR, "Couldn't connect to any of the nodes");
    *errinfo = "None of the nodes are valid";
    return LCB_CONNECT_ERROR;
}

struct nameinfo_common {
    char remote[NI_MAXHOST + NI_MAXSERV + 2];
    char local[NI_MAXHOST + NI_MAXSERV + 2];
};

static int saddr_to_string(struct sockaddr *saddr, int len,
                           char *buf, lcb_size_t nbuf)
{
    char h[NI_MAXHOST + 1];
    char p[NI_MAXSERV + 1];
    int rv;

    rv = getnameinfo(saddr, len, h, sizeof(h), p, sizeof(p),
                     NI_NUMERICHOST | NI_NUMERICSERV);
    if (rv < 0) {
        return 0;
    }

    if (snprintf(buf, nbuf, "%s;%s", h, p) < 0) {
        return 0;
    }

    return 1;
}

int lcb_get_nameinfo(lcb_connection_t conn, struct lcb_nibufs_st *nistrs)
{
    struct sockaddr_storage sa_local;
    struct sockaddr_storage sa_remote;
    int n_salocal, n_saremote;
    struct lcb_nameinfo_st ni;
    int rv;

    n_salocal = sizeof(sa_local);
    n_saremote = sizeof(sa_remote);

    ni.local.name = (struct sockaddr *)&sa_local;
    ni.local.len = &n_salocal;

    ni.remote.name = (struct sockaddr *)&sa_remote;
    ni.remote.len = &n_saremote;

    if (conn->io->version == 1) {
        rv = conn->io->v.v1.get_nameinfo(conn->io, conn->sockptr, &ni);

        if (ni.local.len == 0 || ni.remote.len == 0 || rv < 0) {
            return 0;
        }

    } else {
        socklen_t sl_tmp = sizeof(sa_local);

        rv = getsockname(conn->sockfd, ni.local.name, &sl_tmp);
        n_salocal = sl_tmp;
        if (rv < 0) {
            return 0;
        }
        rv = getpeername(conn->sockfd, ni.remote.name, &sl_tmp);
        n_saremote = sl_tmp;
        if (rv < 0) {
            return 0;
        }
    }

    if (!saddr_to_string(ni.remote.name, *ni.remote.len,
                         nistrs->remote, sizeof(nistrs->remote))) {
        return 0;
    }

    if (!saddr_to_string(ni.local.name, *ni.local.len,
                         nistrs->local, sizeof(nistrs->local))) {
        return 0;
    }
    return 1;
}
