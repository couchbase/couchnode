/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2017-2018 Couchbase, Inc.
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

#include "internal.h"

void lcbcrypto_ref(lcbcrypto_PROVIDER *provider)
{
    provider->_refcnt++;
}

void lcbcrypto_unref(lcbcrypto_PROVIDER *provider)
{
    provider->_refcnt--;
    if (provider->_refcnt == 0 && provider->destructor) {
        provider->destructor(provider);
    }
}

void lcbcrypto_register(lcb_t instance, const char *name, lcbcrypto_PROVIDER *provider)
{
    std::map< std::string, lcbcrypto_PROVIDER * >::iterator old = instance->crypto->find(name);
    if (old != instance->crypto->end()) {
        lcbcrypto_unref(old->second);
    }
    lcbcrypto_ref(provider);
    (*instance->crypto)[name] = provider;
}

void lcbcrypto_unregister(lcb_t instance, const char *name)
{
    std::map< std::string, lcbcrypto_PROVIDER * >::iterator old = instance->crypto->find(name);
    if (old != instance->crypto->end()) {
        lcbcrypto_unref(old->second);
        instance->crypto->erase(old);
    }
}

static bool lcbcrypto_is_valid(lcbcrypto_PROVIDER *provider)
{
    if (!(provider && provider->_refcnt > 0)) {
        return false;
    }
    if (provider->version != 0) {
        return false;
    }
    if (provider->v.v0.sign && provider->v.v0.verify_signature == NULL) {
        return false;
    }
    return provider->v.v0.load_key && provider->v.v0.encrypt && provider->v.v0.decrypt;
}

#define PROVIDER_LOAD_KEY(provider, type, keyid, key, nkey)                                                            \
    (provider)->v.v0.load_key((provider), (type), (keyid), (key), (nkey))

#define PROVIDER_NEED_SIGN(provider) (provider)->v.v0.sign != NULL
#define PROVIDER_SIGN(provider, parts, nparts, sig, nsig)                                                              \
    (provider)->v.v0.sign((provider), (parts), (nparts), (sig), (nsig));
#define PROVIDER_VERIFY_SIGNATURE(provider, parts, nparts, sig, nsig)                                                  \
    (provider)->v.v0.verify_signature((provider), (parts), (nparts), (sig), (nsig));

#define PROVIDER_NEED_IV(provider) (provider)->v.v0.generate_iv != NULL
#define PROVIDER_GENERATE_IV(provider, iv, niv) (provider)->v.v0.generate_iv((provider), (iv), (niv))

#define PROVIDER_ENCRYPT(provider, ptext, nptext, key, nkey, iv, niv, ctext, nctext)                                   \
    (provider)->v.v0.encrypt((provider), (ptext), (nptext), (key), (nkey), (iv), (niv), (ctext), (nctext));
#define PROVIDER_DECRYPT(provider, ctext, nctext, key, nkey, iv, niv, ptext, nptext)                                   \
    (provider)->v.v0.decrypt((provider), (ctext), (nctext), (key), (nkey), (iv), (niv), (ptext), (nptext));

#define PROVIDER_RELEASE_BYTES(provider, bytes)                                                                        \
    if ((bytes) && (provider)->v.v0.release_bytes) {                                                                   \
        (provider)->v.v0.release_bytes((provider), (bytes));                                                           \
    }

lcb_error_t lcbcrypto_encrypt_document(lcb_t instance, lcbcrypto_CMDENCRYPT *cmd)
{
    cmd->out = NULL;
    cmd->nout = 0;

    Json::Value jdoc;
    if (!Json::Reader().parse(cmd->doc, cmd->doc + cmd->ndoc, jdoc)) {
        return LCB_EINVAL;
    }
    bool changed = false;
    std::string prefix = (cmd->prefix == NULL) ? "__crypt_" : cmd->prefix;
    for (size_t ii = 0; ii < cmd->nfields; ii++) {
        lcbcrypto_FIELDSPEC *field = cmd->fields + ii;
        lcb_error_t rc;
        uint8_t *key = NULL;
        size_t nkey = 0;

        lcbcrypto_PROVIDER *provider = (*instance->crypto)[field->alg];
        if (!lcbcrypto_is_valid(provider)) {
            continue;
        }

        rc = PROVIDER_LOAD_KEY(provider, LCBCRYPTO_KEY_ENCRYPT, field->kid, &key, &nkey);
        if (rc != LCB_SUCCESS) {
            PROVIDER_RELEASE_BYTES(provider, key);
            continue;
        }

        if (jdoc.isMember(field->name)) {
            std::string contents = Json::FastWriter().write(jdoc[field->name]);
            Json::Value encrypted;
            int ret;

            uint8_t *iv = NULL;
            char *biv = NULL;
            size_t niv = 0;
            lcb_SIZE nbiv = 0;
            if (PROVIDER_NEED_IV(provider)) {
                rc = PROVIDER_GENERATE_IV(provider, &iv, &niv);
                if (rc != 0) {
                    PROVIDER_RELEASE_BYTES(provider, iv);
                    continue;
                }
                ret = lcb_base64_encode2(reinterpret_cast< char * >(iv), niv, &biv, &nbiv);
                if (ret < 0) {
                    free(biv);
                    PROVIDER_RELEASE_BYTES(provider, iv);
                    continue;
                }
                encrypted["iv"] = biv;
            }
            const uint8_t *ptext = reinterpret_cast< const uint8_t * >(contents.c_str());
            uint8_t *ctext = NULL;
            size_t nptext = contents.size(), nctext = 0;
            rc = PROVIDER_ENCRYPT(provider, ptext, nptext, key, nkey, iv, niv, &ctext, &nctext);
            PROVIDER_RELEASE_BYTES(provider, iv);
            if (rc != LCB_SUCCESS) {
                PROVIDER_RELEASE_BYTES(provider, ctext);
                continue;
            }
            char *btext = NULL;
            lcb_SIZE nbtext = 0;
            ret = lcb_base64_encode2(reinterpret_cast< char * >(ctext), nctext, &btext, &nbtext);
            PROVIDER_RELEASE_BYTES(provider, ctext);
            if (ret < 0) {
                free(btext);
                continue;
            }
            encrypted["ciphertext"] = btext;

            if (PROVIDER_NEED_SIGN(provider)) {
                lcbcrypto_SIGV parts[4] = {};
                size_t nparts = 0;
                uint8_t *sig = NULL;
                size_t nsig = 0;

                parts[nparts].data = reinterpret_cast< const uint8_t * >(field->kid);
                parts[nparts].len = strlen(field->kid);
                nparts++;
                parts[nparts].data = reinterpret_cast< const uint8_t * >(field->alg);
                parts[nparts].len = strlen(field->alg);
                nparts++;
                if (biv) {
                    parts[nparts].data = reinterpret_cast< const uint8_t * >(biv);
                    parts[nparts].len = nbiv;
                    nparts++;
                }
                parts[nparts].data = reinterpret_cast< const uint8_t * >(btext);
                parts[nparts].len = nbtext;
                nparts++;

                rc = PROVIDER_SIGN(provider, parts, nparts, &sig, &nsig);
                if (rc != LCB_SUCCESS) {
                    PROVIDER_RELEASE_BYTES(provider, sig);
                    continue;
                }
                char *bsig = NULL;
                lcb_SIZE nbsig = 0;
                ret = lcb_base64_encode2(reinterpret_cast< char * >(sig), nsig, &bsig, &nbsig);
                PROVIDER_RELEASE_BYTES(provider, sig);
                if (ret < 0) {
                    free(bsig);
                    continue;
                }
                encrypted["sig"] = bsig;
                free(bsig);
            }
            free(biv);
            free(btext);
            encrypted["kid"] = field->kid;
            encrypted["alg"] = field->alg;
            jdoc[prefix + field->name] = encrypted;
            jdoc.removeMember(field->name);
            changed = true;
        }
    }
    if (changed) {
        std::string doc = Json::FastWriter().write(jdoc);
        cmd->out = strdup(doc.c_str());
        cmd->nout = strlen(cmd->out);
    }
    return LCB_SUCCESS;
}

lcb_error_t lcbcrypto_decrypt_document(lcb_t instance, lcbcrypto_CMDDECRYPT *cmd)
{
    cmd->out = NULL;
    cmd->nout = 0;

    Json::Value jdoc;
    if (!Json::Reader().parse(cmd->doc, cmd->doc + cmd->ndoc, jdoc)) {
        return LCB_EINVAL;
    }

    if (!jdoc.isObject()) {
        return LCB_EINVAL;
    }

    bool changed = false;
    std::string prefix = (cmd->prefix == NULL) ? "__crypt_" : cmd->prefix;

    const Json::Value::Members names = jdoc.getMemberNames();
    for (Json::Value::Members::const_iterator ii = names.begin(); ii != names.end(); ii++) {
        const std::string &name = *ii;
        if (name.size() <= prefix.size()) {
            continue;
        }
        if (prefix.compare(0, prefix.size(), name, 0, prefix.size()) != 0) {
            continue;
        }
        Json::Value &encrypted = jdoc[name];
        if (!encrypted.isObject()) {
            continue;
        }

        Json::Value &jalg = encrypted["alg"];
        if (!jalg.isString()) {
            continue;
        }
        const std::string &alg = jalg.asString();

        Json::Value &jkid = encrypted["kid"];
        if (!jkid.isString()) {
            continue;
        }
        const std::string &kid = jkid.asString();

        Json::Value &jiv = encrypted["iv"];
        const char *biv = NULL;
        size_t nbiv = 0;
        if (jiv.isString()) {
            biv = jiv.asCString();
            nbiv = strlen(biv);
        }

        int ret;
        lcb_error_t rc;

        lcbcrypto_PROVIDER *provider = (*instance->crypto)[alg];
        if (!lcbcrypto_is_valid(provider)) {
            continue;
        }
        Json::Value &jctext = encrypted["ciphertext"];
        if (!jctext.isString()) {
            continue;
        }
        const std::string &btext = jctext.asString();

        if (PROVIDER_NEED_SIGN(provider)) {
            Json::Value &jsig = encrypted["sig"];
            if (!jsig.isString()) {
                /* TODO: warn about missing signature? */
                continue;
            }
            uint8_t *sig = NULL;
            lcb_SIZE nsig = 0;
            const std::string &bsig = jsig.asString();
            ret = lcb_base64_decode2(bsig.c_str(), bsig.size(), reinterpret_cast< char ** >(&sig), &nsig);
            if (ret < 0) {
                PROVIDER_RELEASE_BYTES(provider, sig);
                continue;
            }

            lcbcrypto_SIGV parts[4] = {};
            size_t nparts = 0;

            parts[nparts].data = reinterpret_cast< const uint8_t * >(kid.c_str());
            parts[nparts].len = kid.size();
            nparts++;
            parts[nparts].data = reinterpret_cast< const uint8_t * >(alg.c_str());
            parts[nparts].len = alg.size();
            nparts++;
            if (biv) {
                parts[nparts].data = reinterpret_cast< const uint8_t * >(biv);
                parts[nparts].len = nbiv;
                nparts++;
            }
            parts[nparts].data = reinterpret_cast< const uint8_t * >(btext.c_str());
            parts[nparts].len = btext.size();
            nparts++;

            rc = PROVIDER_VERIFY_SIGNATURE(provider, parts, nparts, sig, nsig);
            free(sig);
            if (rc != LCB_SUCCESS) {
                continue;
            }
        }

        uint8_t *ctext = NULL;
        lcb_SIZE nctext = 0;
        ret = lcb_base64_decode2(btext.c_str(), btext.size(), reinterpret_cast< char ** >(&ctext), &nctext);
        if (ret < 0) {
            continue;
        }

        uint8_t *key = NULL;
        size_t nkey = 0;
        rc = PROVIDER_LOAD_KEY(provider, LCBCRYPTO_KEY_DECRYPT, kid.c_str(), &key, &nkey);
        if (rc != LCB_SUCCESS) {
            free(ctext);
            PROVIDER_RELEASE_BYTES(provider, key);
            continue;
        }

        uint8_t *iv = NULL;
        lcb_SIZE niv = 0;
        if (biv) {
            ret = lcb_base64_decode2(biv, nbiv, reinterpret_cast< char ** >(&iv), &niv);
            if (ret < 0) {
                free(ctext);
                PROVIDER_RELEASE_BYTES(provider, key);
                continue;
            }
        }

        uint8_t *ptext = NULL;
        size_t nptext = 0;
        rc = PROVIDER_DECRYPT(provider, ctext, nctext, key, nkey, iv, niv, &ptext, &nptext);
        PROVIDER_RELEASE_BYTES(provider, key);
        free(ctext);
        if (rc != LCB_SUCCESS) {
            PROVIDER_RELEASE_BYTES(provider, ptext);
            continue;
        }
        Json::Value frag;
        char *json = reinterpret_cast< char * >(ptext);
        bool valid_json = Json::Reader().parse(json, json + nptext, frag);
        PROVIDER_RELEASE_BYTES(provider, ptext);
        if (!valid_json) {
            continue;
        }
        jdoc[name.substr(prefix.size())] = frag;
        jdoc.removeMember(name);
        changed = true;
    }
    if (changed) {
        std::string doc = Json::FastWriter().write(jdoc);
        cmd->out = strdup(doc.c_str());
        cmd->nout = strlen(cmd->out);
    }
    return LCB_SUCCESS;
}
