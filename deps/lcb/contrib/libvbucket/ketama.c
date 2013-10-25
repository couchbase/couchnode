/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
#include <stdlib.h>
#include "hash.h"

/* Force md5 functions to be static. The compiler could show warnings but
 * it ok, we did it because we need to keep files in vendor/ directory
 * unmodified. */
static void MD5Init();
static void MD5Update();
static void MD5Final();

/* This library uses the reference MD5 implementation from [RFC1321] */
#define PROTOTYPES 1
#include "rfc1321/md5c.c"
#undef  PROTOTYPES

void hash_md5(const char *key, size_t key_length, unsigned char *result)
{
    MD5_CTX ctx;

    MD5Init(&ctx);
    MD5Update(&ctx, (unsigned char *)key, (unsigned int)key_length);
    MD5Final(result, &ctx);
}

void* hash_md5_update(void *ctx, const char *key, size_t key_length)
{
    if (ctx == NULL) {
        ctx = calloc(1, sizeof(MD5_CTX));
        MD5Init(ctx);
    }
    MD5Update(ctx, (unsigned char *)key, (unsigned int)key_length);
    return ctx;
}

void hash_md5_final(void *ctx, unsigned char *result)
{
    if (ctx == NULL) {
        return;
    }
    MD5Final(result, ctx);
    free(ctx);
}

uint32_t hash_ketama(const char *key, size_t key_length)
{
    unsigned char digest[16];

    hash_md5(key, key_length, digest);

    return (uint32_t) ( (digest[3] << 24)
                       |(digest[2] << 16)
                       |(digest[1] << 8)
                       | digest[0]);
}
