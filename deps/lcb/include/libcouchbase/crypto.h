/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2018 Couchbase, Inc.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

#ifndef LCB_CRYPTO_H
#define LCB_CRYPTO_H

/**
 * @file
 * Field encryption
 *
 * @uncommitted
 */

#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
    /* encryption (e.g. private key for assymetric ciphers) */
    LCBCRYPTO_KEY_ENCRYPT = 0,
    /* decryption (e.g. private key for assymetric ciphers) */
    LCBCRYPTO_KEY_DECRYPT = 1,
    LCBCRYPTO_KEY__MAX
} lcbcrypto_KEYTYPE;

typedef struct lcbcrypto_SIGV {
    const uint8_t *data;
    size_t len;
} lcbcrypto_SIGV;

struct lcbcrypto_PROVIDER;
typedef struct lcbcrypto_PROVIDER {
    uint16_t version;
    int16_t _refcnt;
    uint64_t flags;
    void *cookie;
    void (*destructor)(struct lcbcrypto_PROVIDER *provider);
    union {
        struct {
            void (*release_bytes)(struct lcbcrypto_PROVIDER *provider, void *bytes);
            lcb_error_t (*load_key)(struct lcbcrypto_PROVIDER *provider, lcbcrypto_KEYTYPE type, const char *keyid,
                                    uint8_t **key, size_t *key_len);
            lcb_error_t (*generate_iv)(struct lcbcrypto_PROVIDER *provider, uint8_t **iv, size_t *iv_len);
            lcb_error_t (*sign)(struct lcbcrypto_PROVIDER *provider, const lcbcrypto_SIGV *inputs, size_t input_num,
                                uint8_t **sig, size_t *sig_len);
            lcb_error_t (*verify_signature)(struct lcbcrypto_PROVIDER *provider, const lcbcrypto_SIGV *inputs,
                                            size_t input_num, uint8_t *sig, size_t sig_len);
            lcb_error_t (*encrypt)(struct lcbcrypto_PROVIDER *provider, const uint8_t *input, size_t input_len,
                                   const uint8_t *key, size_t key_len, const uint8_t *iv, size_t iv_len,
                                   uint8_t **output, size_t *output_len);
            lcb_error_t (*decrypt)(struct lcbcrypto_PROVIDER *provider, const uint8_t *input, size_t input_len,
                                   const uint8_t *key, size_t key_len, const uint8_t *iv, size_t iv_len,
                                   uint8_t **output, size_t *output_len);
        } v0;
    } v;
} lcbcrypto_PROVIDER;

typedef struct lcbcrypto_FIELDSPEC {
    const char *name;
    const char *alg;
    const char *kid;
} lcbcrypto_FIELDSPEC;

typedef struct lcbcrypto_CMDENCRYPT {
    uint16_t version;
    const char *prefix;
    const char *doc;
    size_t ndoc;
    char *out;
    size_t nout;
    lcbcrypto_FIELDSPEC *fields;
    size_t nfields;
} lcbcrypto_CMDENCRYPT;

typedef struct lcbcrypto_CMDDECRYPT {
    uint16_t version;
    const char *prefix;
    const char *doc;
    size_t ndoc;
    char *out;
    size_t nout;
} lcbcrypto_CMDDECRYPT;

/**
 * @uncommitted
 */
LIBCOUCHBASE_API void lcbcrypto_register(lcb_t instance, const char *name, lcbcrypto_PROVIDER *provider);

/**
 * @uncommitted
 */
LIBCOUCHBASE_API void lcbcrypto_unregister(lcb_t instance, const char *name);

/**
 * @uncommitted
 */
LIBCOUCHBASE_API void lcbcrypto_ref(lcbcrypto_PROVIDER *provider);

/**
 * @uncommitted
 */
LIBCOUCHBASE_API void lcbcrypto_unref(lcbcrypto_PROVIDER *provider);

/**
 * @uncommitted
 *
 * encrypt and replace fields specified by JSON paths (zero-terminated) with encrypted contents
 */
LIBCOUCHBASE_API lcb_error_t lcbcrypto_encrypt_document(lcb_t instance, lcbcrypto_CMDENCRYPT *cmd);

/**
 * @uncommitted
 *
 * find and decrypt all fields in the JSON encoded object
 */
LIBCOUCHBASE_API lcb_error_t lcbcrypto_decrypt_document(lcb_t instance, lcbcrypto_CMDDECRYPT *cmd);

#ifdef __cplusplus
}
#endif
#endif /* LCB_CRYPTO_H */
