/* small utility for retrieving host/port information from the CTX */
static const char* get__ctx_hostinfo(const lcbio_CTX *ctx, int is_host)
{
    if (ctx == NULL || ctx->sock == NULL || ctx->sock->info == NULL) {
        return is_host ? "NOHOST" : "NOPORT";
    }
    return is_host ? ctx->sock->info->ep.host : ctx->sock->info->ep.port;
}
static const char *get_ctx_host(const lcbio_CTX *ctx) { return get__ctx_hostinfo(ctx, 1); }
static const char *get_ctx_port(const lcbio_CTX *ctx) { return get__ctx_hostinfo(ctx, 0); }
