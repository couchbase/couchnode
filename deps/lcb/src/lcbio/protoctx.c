#include "connect.h"

void
lcbio_protoctx_add(lcbio_SOCKET *sock, lcbio_PROTOCTX *ctx)
{
    lcb_list_append(&sock->protos, &ctx->ll);
}

lcbio_PROTOCTX *
lcbio_protoctx_get(lcbio_SOCKET *sock, lcbio_PROTOID id)
{
    lcb_list_t *ll;
    LCB_LIST_FOR(ll, &sock->protos) {
        lcbio_PROTOCTX *cur = LCB_LIST_ITEM(ll, lcbio_PROTOCTX, ll);
        if (cur->id == id) {
            return cur;
        }
    }
    return NULL;
}


#define DEL_BY_ID 1
#define DEL_BY_PTR 2
static lcbio_PROTOCTX *
del_common(lcbio_SOCKET *sock, int mode, lcbio_PROTOID id,
           lcbio_PROTOCTX *ctx, int dtor)
{
    lcb_list_t *ll, *next;
    LCB_LIST_SAFE_FOR(ll, next, &sock->protos) {
        lcbio_PROTOCTX *cur = LCB_LIST_ITEM(ll, lcbio_PROTOCTX, ll);
        if (mode == DEL_BY_ID && cur->id != id) {
            continue;
        } else if (cur != ctx) {
            continue;
        }
        lcb_list_delete(&cur->ll);
        if (dtor) {
            cur->dtor(cur);
        }
        return cur;
    }
    return NULL;
}

lcbio_PROTOCTX *
lcbio_protoctx_delid(lcbio_SOCKET *s, lcbio_PROTOID id, int dtor)
{
    return del_common(s, DEL_BY_ID, id, NULL, dtor);
}

void
lcbio_protoctx_delptr(lcbio_SOCKET *s, lcbio_PROTOCTX *ctx, int dtor)
{
    del_common(s, DEL_BY_PTR, 0, ctx, dtor);
}

void
lcbio__protoctx_delall(lcbio_SOCKET *s)
{
    lcb_list_t *llcur, *llnext;
    LCB_LIST_SAFE_FOR(llcur, llnext, &s->protos) {
        lcbio_PROTOCTX *cur = LCB_LIST_ITEM(llcur, lcbio_PROTOCTX, ll);
        lcb_list_delete(llcur);
        cur->dtor(cur);
    }
}
