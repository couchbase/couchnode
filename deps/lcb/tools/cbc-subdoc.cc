/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2017-2020 Couchbase, Inc.
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

#include "config.h"
#include <libcouchbase/couchbase.h>
#include <iostream>
#include <map>
#include <cstdio>
#include <stdexcept>
#include "common/options.h"
#include "common/histogram.h"
#include <libcouchbase/metrics.h>

#include "linenoise/linenoise.h"

static std::string get_resp_key(const lcb_RESPSUBDOC *resp)
{
    const char *p;
    size_t n;

    lcb_respsubdoc_key(resp, &p, &n);
    if (!n) {
        return "";
    }
    return std::string(p, n);
}

extern "C" {
void subdoc_callback(lcb_INSTANCE *, int, const lcb_RESPSUBDOC *resp)
{
    lcb_STATUS rc;
    std::string key = get_resp_key(resp);

    rc = lcb_respsubdoc_status(resp);
    if (rc == LCB_SUCCESS) {
        uint64_t cas;
        lcb_respsubdoc_cas(resp, &cas);
        fprintf(stderr, "%-20s CAS=0x%" PRIx64 "\n", key.c_str(), cas);
    } else {
        fprintf(stderr, "%-20s %s\n", key.c_str(), lcb_strerror_short(rc));
        const lcb_KEY_VALUE_ERROR_CONTEXT *ctx;
        lcb_respsubdoc_error_context(resp, &ctx);
        const char *context, *ref;
        size_t context_len, ref_len;
        lcb_errctx_kv_context(ctx, &context, &context_len);
        fprintf(stderr, "%-20s %.*s\n", "", (int)context_len, context);
        lcb_errctx_kv_ref(ctx, &ref, &ref_len);
        fprintf(stderr, "%-20s Ref: %.*s\n", "", (int)ref_len, ref);
    }
    size_t total = lcb_respsubdoc_result_size(resp);
    for (size_t ii = 0; ii < total; ii++) {
        rc = lcb_respsubdoc_result_status(resp, ii);
        const char *value;
        size_t nvalue;
        lcb_respsubdoc_result_value(resp, ii, &value, &nvalue);
        printf("%d. Size=%lu, RC=%s\n", (int)ii, (unsigned long)nvalue, lcb_strerror_short(rc));
        fflush(stdout);
        if (nvalue > 0) {
            fwrite(value, 1, nvalue, stdout);
            printf("\n");
            fflush(stdout);
        }
    }
}
}

#define CBCSUBDOC_HISTORY_FILENAME ".cbcsubdoc_history"

using namespace cbc;
using namespace cliopts;

static void do_or_die(lcb_STATUS rc, const std::string &msg = "")
{
    if (rc != LCB_SUCCESS) {
        std::stringstream ss;
        if (!msg.empty()) {
            ss << msg << ". ";
        }
        ss << lcb_strerror_short(rc);
        throw std::runtime_error(ss.str());
    }
}

static lcb_INSTANCE *instance = nullptr;
static Histogram hg;

class Configuration
{
  public:
    Configuration() = default;

    ~Configuration() = default;

    void addToParser(Parser &parser)
    {
        m_params.addToParser(parser);
    }

    void processOptions() {}

    void fillCropts(lcb_CREATEOPTS *&opts)
    {
        m_params.fillCropts(opts);
    }
    lcb_STATUS doCtls()
    {
        return m_params.doCtls(instance);
    }
    bool useTimings()
    {
        return m_params.useTimings();
    }
    bool shouldDump()
    {
        return m_params.shouldDump();
    }

  private:
    ConnParams m_params;
};

static Configuration config;

static const char *handlers_sorted[] = {"help",
                                        "dump",
                                        "get",
                                        "set",
                                        "exists",
                                        "remove",
                                        "replace",
                                        "array-insert",
                                        "array-add-first",
                                        "array-add-last",
                                        "array-add-unique",
                                        "dict-add",
                                        "dict-upsert",
                                        "counter",
                                        "size",
                                        nullptr};

typedef enum {
    SUBDOC_GET = 1,
    SUBDOC_EXISTS,
    SUBDOC_REPLACE,
    SUBDOC_DICT_ADD,
    SUBDOC_DICT_UPSERT,
    SUBDOC_ARRAY_ADD_FIRST,
    SUBDOC_ARRAY_ADD_LAST,
    SUBDOC_ARRAY_ADD_UNIQUE,
    SUBDOC_ARRAY_INSERT,
    SUBDOC_COUNTER,
    SUBDOC_REMOVE,
    SUBDOC_GET_COUNT,
    SUBDOC_GET_FULLDOC,
    SUBDOC_SET_FULLDOC,
    SUBDOC_REMOVE_FULLDOC
} SubdocOperation;

static void command_completion(const char *buf, linenoiseCompletions *lc)
{
    size_t nbuf = strlen(buf);
    for (const char **cur = handlers_sorted; *cur; cur++) {
        if (memcmp(buf, *cur, nbuf) == 0) {
            linenoiseAddCompletion(lc, *cur);
        }
    }
}

namespace subdoc
{
class Handler;
}

static std::map<std::string, subdoc::Handler *> handlers;

namespace subdoc
{
#define HANDLER_DESCRIPTION(s)                                                                                         \
    const char *description() const override                                                                           \
    {                                                                                                                  \
        return s;                                                                                                      \
    }
#define HANDLER_USAGE(s)                                                                                               \
    const char *usagestr() const override                                                                              \
    {                                                                                                                  \
        return s;                                                                                                      \
    }

class Handler
{
  public:
    explicit Handler(const char *name) : parser(name)
    {
        if (name != nullptr) {
            cmdname = name;
        }
        parser.default_settings.error_noexit = 1;
        parser.default_settings.help_noexit = 1;
    }

    virtual ~Handler() = default;
    virtual const char *description() const
    {
        return nullptr;
    }
    virtual const char *usagestr() const
    {
        return nullptr;
    }
    void execute(int argc, char **argv)
    {
        parser.reset();
        parser.default_settings.argstring = usagestr();
        parser.default_settings.shortdesc = description();
        addOptions();
        if (parser.parse(argc, argv, true)) {
            run();
        }
    }

  protected:
    virtual const std::string &getLoneArg(bool required)
    {
        static std::string empty;

        const std::vector<std::string> &args = parser.getRestArgs();
        if (args.empty() || args.size() != 1) {
            if (required) {
                throw BadArg("Command requires single argument");
            }
            return empty;
        }
        return args[0];
    }

    virtual const std::string &getRequiredArg()
    {
        return getLoneArg(true);
    }

    virtual void addOptions() {}

    virtual void run() = 0;

    cliopts::Parser parser;
    std::string cmdname;
};

class LookupHandler : public Handler
{
  public:
    HANDLER_USAGE("[OPTIONS...] KEY...")

    LookupHandler(const char *name, SubdocOperation opcode, const char *description_)
        : Handler(name), m_opcode(opcode), m_description(description_), o_paths("path"), o_xattrs("xattr"),
          o_deleted("deleted")
    {
        o_paths.abbrev('p').argdesc("PATH").description("JSON path in the document");
        o_xattrs.abbrev('x').argdesc("PATH").description("Access XATTR path (exentnded attributes)");
        o_deleted.abbrev('d').description("Access XATTR attributes of deleted documents");
    }

    const char *description() const override
    {
        return m_description;
    }

  protected:
    void addOptions() override
    {
        Handler::addOptions();
        parser.addOption(o_paths.reset());
        parser.addOption(o_xattrs.reset());
        parser.addOption(o_deleted.reset());
    }

    void run() override
    {
        lcb_STATUS err;

        const std::vector<std::string> &keys = parser.getRestArgs();
        if (keys.empty()) {
            throw BadArg("At least one key has to be specified");
        }
        std::vector<std::string> paths = o_paths.result();
        std::vector<std::string> xattrs = o_xattrs.result();

        if (m_opcode != SUBDOC_GET) {
            if (paths.empty() && xattrs.empty()) {
                throw BadArg("At least one path has to be specified");
            }
        }

        lcb_sched_enter(instance);
        for (const auto &key : keys) {
            lcb_SUBDOCSPECS *specs;
            size_t idx = 0, total = xattrs.size() + paths.size();
            if (paths.empty() && m_opcode == SUBDOC_GET) {
                total += 1; /* for fulldoc get */
            }
            lcb_subdocspecs_create(&specs, total);
            for (const auto &xattr : xattrs) {
                uint32_t flags = LCB_SUBDOCSPECS_F_XATTRPATH;
                if (o_deleted.passed()) {
                    flags |= LCB_SUBDOCSPECS_F_XATTR_DELETED_OK;
                }
                switch (m_opcode) {
                    case SUBDOC_GET:
                        lcb_subdocspecs_get(specs, idx++, flags, xattr.c_str(), xattr.size());
                        break;
                    case SUBDOC_EXISTS:
                        lcb_subdocspecs_exists(specs, idx++, flags, xattr.c_str(), xattr.size());
                        break;
                    case SUBDOC_GET_COUNT:
                        lcb_subdocspecs_get_count(specs, idx++, flags, xattr.c_str(), xattr.size());
                        break;
                    default:
                        break;
                }
            }
            for (const auto &path : paths) {
                switch (m_opcode) {
                    case SUBDOC_GET:
                        lcb_subdocspecs_get(specs, idx++, 0, path.c_str(), path.size());
                        break;
                    case SUBDOC_EXISTS:
                        lcb_subdocspecs_exists(specs, idx++, 0, path.c_str(), path.size());
                        break;
                    case SUBDOC_GET_COUNT:
                        lcb_subdocspecs_get_count(specs, idx++, 0, path.c_str(), path.size());
                        break;
                    default:
                        break;
                }
            }
            if (paths.empty() && m_opcode == SUBDOC_GET) {
                lcb_subdocspecs_get(specs, idx, 0, nullptr, 0);
            }

            lcb_CMDSUBDOC *cmd;
            lcb_cmdsubdoc_create(&cmd);
            lcb_cmdsubdoc_key(cmd, key.c_str(), key.size());
            lcb_cmdsubdoc_specs(cmd, specs);
            err = lcb_subdoc(instance, this, cmd);
            lcb_subdocspecs_destroy(specs);
            lcb_cmdsubdoc_destroy(cmd);
            if (err != LCB_SUCCESS) {
                throw LcbError(err, "Failed to schedule " + cmdname + " command");
            }
        }
        lcb_sched_leave(instance);
        err = lcb_wait(instance, LCB_WAIT_DEFAULT);
        if (err != LCB_SUCCESS) {
            throw LcbError(err, "Failed to execute " + cmdname + " command");
        }
    }

  protected:
    SubdocOperation m_opcode;
    const char *m_description;

    cliopts::ListOption o_paths;
    cliopts::ListOption o_xattrs;
    cliopts::BoolOption o_deleted;
};

class RemoveHandler : public Handler
{
  public:
    HANDLER_DESCRIPTION("Remove path in the item on the server")
    HANDLER_USAGE("[OPTIONS...] KEY...")

    explicit RemoveHandler(const char *name = "remove") : Handler(name), o_paths("path"), o_xattrs("xattr")
    {
        o_paths.abbrev('p').argdesc("PATH").description(
            "JSON path in the document. When skipped, the operation applied to full document.");
        o_xattrs.abbrev('x').argdesc("PATH").description("Access XATTR path (exentnded attributes)");
    }

  protected:
    void addOptions() override
    {
        Handler::addOptions();
        parser.addOption(o_paths.reset());
        parser.addOption(o_xattrs.reset());
    }

    void run() override
    {
        lcb_STATUS err;

        const std::vector<std::string> &keys = parser.getRestArgs();
        if (keys.empty()) {
            throw BadArg("At least one key has to be specified");
        }
        std::vector<std::string> paths = o_paths.result();
        std::vector<std::string> xattrs = o_xattrs.result();

        lcb_sched_enter(instance);
        for (const auto &key : keys) {
            lcb_SUBDOCSPECS *specs;
            size_t idx = 0, total = xattrs.size() + (paths.empty() ? 1 : paths.size());

            lcb_subdocspecs_create(&specs, total);
            for (const auto &xattr : xattrs) {
                lcb_subdocspecs_remove(specs, idx++, LCB_SUBDOCSPECS_F_XATTRPATH, xattr.c_str(), xattr.size());
            }
            for (const auto &path : paths) {
                lcb_subdocspecs_remove(specs, idx++, 0, path.c_str(), path.size());
            }
            if (paths.empty()) {
                lcb_subdocspecs_remove(specs, idx, 0, nullptr, 0);
            }

            lcb_CMDSUBDOC *cmd;
            lcb_cmdsubdoc_create(&cmd);
            lcb_cmdsubdoc_key(cmd, key.c_str(), key.size());
            lcb_cmdsubdoc_specs(cmd, specs);
            err = lcb_subdoc(instance, this, cmd);
            lcb_subdocspecs_destroy(specs);
            lcb_cmdsubdoc_destroy(cmd);
            if (err != LCB_SUCCESS) {
                throw LcbError(err, "Failed to schedule remove command");
            }
        }
        lcb_sched_leave(instance);
        err = lcb_wait(instance, LCB_WAIT_DEFAULT);
        if (err != LCB_SUCCESS) {
            throw LcbError(err, "Failed to execute remove");
        }
    }

  protected:
    cliopts::ListOption o_paths;
    cliopts::ListOption o_xattrs;
};

class UpsertHandler : public Handler
{
  public:
    HANDLER_DESCRIPTION("Store document on the server")
    HANDLER_USAGE("[OPTIONS...] KEY VALUE")

    explicit UpsertHandler(const char *name = "upsert") : Handler(name), o_xattrs("xattr"), o_expiry("expiry")
    {
        o_xattrs.abbrev('x').argdesc("PATH=VALUE").description("Store XATTR path (exentnded attributes)");
        o_expiry.abbrev('e').argdesc("TIME").description(
            "Expiration time in seconds. Relative (up to 30 days) or absolute (as Unix timestamp)");
    }

  protected:
    void addOptions() override
    {
        Handler::addOptions();
        parser.addOption(o_xattrs.reset());
        parser.addOption(o_expiry.reset());
    }

    void run() override
    {
        lcb_STATUS err;

        const std::vector<std::string> &args = parser.getRestArgs();
        if (args.size() != 2) {
            throw BadArg("Exactly two arguments required: KEY and VALUE");
        }
        std::string key = args[0];
        std::string value = args[1];
        std::vector<std::pair<std::string, std::string>> xattrs = o_xattrs.result();

        size_t idx = 0, total = xattrs.size() + 1;
        if (xattrs.empty()) {
            total += 1;
        }
        lcb_SUBDOCSPECS *specs;
        lcb_subdocspecs_create(&specs, total);

        std::string ver = "\"" LCB_CLIENT_ID "\"";
        std::string path = "_cbc.version";

        if (o_xattrs.passed()) {
            for (const auto &xattr : xattrs) {
                lcb_subdocspecs_dict_upsert(
                    specs, idx++, LCB_SUBDOCSPECS_F_XATTRPATH | LCB_SUBDOCSPECS_F_MKINTERMEDIATES, xattr.first.c_str(),
                    xattr.first.size(), xattr.second.c_str(), xattr.second.size());
            }
        } else {
            // currently it is not possible to upsert document without XATTRs
            // so lets allocate "_cbc" object with some useful stuff
            lcb_subdocspecs_dict_upsert(specs, idx++, LCB_SUBDOCSPECS_F_XATTRPATH | LCB_SUBDOCSPECS_F_MKINTERMEDIATES,
                                        path.c_str(), path.size(), ver.c_str(), ver.size());
        }
        lcb_subdocspecs_replace(specs, idx, 0, nullptr, 0, value.c_str(), value.size());

        lcb_CMDSUBDOC *cmd;
        lcb_cmdsubdoc_create(&cmd);
        lcb_cmdsubdoc_key(cmd, key.c_str(), key.size());
        lcb_cmdsubdoc_specs(cmd, specs);
        lcb_cmdsubdoc_store_semantics(cmd, LCB_SUBDOC_STORE_UPSERT);
        if (o_expiry.passed()) {
            lcb_cmdsubdoc_expiry(cmd, o_expiry.result());
        }

        lcb_sched_enter(instance);
        err = lcb_subdoc(instance, this, cmd);
        lcb_subdocspecs_destroy(specs);
        lcb_cmdsubdoc_destroy(cmd);
        if (err != LCB_SUCCESS) {
            throw LcbError(err, "Failed to schedule upsert command");
        }
        lcb_sched_leave(instance);

        err = lcb_wait(instance, LCB_WAIT_DEFAULT);
        if (err != LCB_SUCCESS) {
            throw LcbError(err, "Failed to execute upsert");
        }
    }

  protected:
    cliopts::PairListOption o_xattrs;
    cliopts::UIntOption o_expiry;
};

class MutationHandler : public Handler
{
  public:
    HANDLER_USAGE("[OPTIONS...] KEY...")

    MutationHandler(const char *name, SubdocOperation opcode, const char *description_,
                    bool enable_intermediates = true)
        : Handler(name), m_opcode(opcode), m_description(description_), o_paths("path"), o_xattrs("xattr"),
          o_expiry("expiry"), o_intermediates("intermediates"), o_upsert("upsert"),
          m_enable_intermediates(enable_intermediates)
    {
        o_paths.abbrev('p').argdesc("PATH=VALUE").description("JSON path in the document");
        o_xattrs.abbrev('x').argdesc("PATH=VALUE").description("XATTR path (exentnded attributes)");
        o_expiry.abbrev('e').argdesc("TIME").description(
            "Expiration time in seconds. Relative (up to 30 days) or absolute (as Unix timestamp)");
        o_intermediates.abbrev('i').description("Create intermediate paths");
        o_upsert.abbrev('u').description("Create document if it doesn't exist");
    }

    const char *description() const override
    {
        return m_description;
    }

  protected:
    void addOptions() override
    {
        Handler::addOptions();
        parser.addOption(o_xattrs.reset());
        parser.addOption(o_paths.reset());
        parser.addOption(o_expiry.reset());
        parser.addOption(o_upsert.reset());
        if (m_enable_intermediates) {
            parser.addOption(o_intermediates.reset());
        }
    }

    void run() override
    {
        lcb_STATUS err;

        const std::vector<std::string> &keys = parser.getRestArgs();
        if (keys.empty()) {
            throw BadArg("At least one key has to be specified");
        }
        std::vector<std::pair<std::string, std::string>> paths = o_paths.result();
        std::vector<std::pair<std::string, std::string>> xattrs = o_xattrs.result();

        if (xattrs.empty() && paths.empty()) {
            throw BadArg("At least one path has to be specified");
        }

        lcb_sched_enter(instance);

        for (const auto &key : keys) {
            size_t idx = 0, total = xattrs.size() + paths.size();
            lcb_SUBDOCSPECS *specs;
            lcb_subdocspecs_create(&specs, total);
            for (const auto &xattr : xattrs) {
                uint32_t flags = LCB_SUBDOCSPECS_F_XATTRPATH;
                if (o_intermediates.passed()) {
                    flags |= LCB_SUBDOCSPECS_F_MKINTERMEDIATES;
                }
                switch (m_opcode) {
                    case SUBDOC_DICT_UPSERT:
                        lcb_subdocspecs_dict_upsert(specs, idx++, flags, xattr.first.c_str(), xattr.first.size(),
                                                    xattr.second.c_str(), xattr.second.size());
                        break;
                    case SUBDOC_DICT_ADD:
                        lcb_subdocspecs_dict_add(specs, idx++, flags, xattr.first.c_str(), xattr.first.size(),
                                                 xattr.second.c_str(), xattr.second.size());
                        break;
                    case SUBDOC_REPLACE:
                        lcb_subdocspecs_replace(specs, idx++, flags, xattr.first.c_str(), xattr.first.size(),
                                                xattr.second.c_str(), xattr.second.size());
                        break;
                    case SUBDOC_ARRAY_ADD_FIRST:
                        lcb_subdocspecs_array_add_first(specs, idx++, flags, xattr.first.c_str(), xattr.first.size(),
                                                        xattr.second.c_str(), xattr.second.size());
                        break;
                    case SUBDOC_ARRAY_ADD_LAST:
                        lcb_subdocspecs_array_add_last(specs, idx++, flags, xattr.first.c_str(), xattr.first.size(),
                                                       xattr.second.c_str(), xattr.second.size());
                        break;
                    case SUBDOC_ARRAY_ADD_UNIQUE:
                        lcb_subdocspecs_array_add_unique(specs, idx++, flags, xattr.first.c_str(), xattr.first.size(),
                                                         xattr.second.c_str(), xattr.second.size());
                        break;
                    case SUBDOC_ARRAY_INSERT:
                        lcb_subdocspecs_array_insert(specs, idx++, flags, xattr.first.c_str(), xattr.first.size(),
                                                     xattr.second.c_str(), xattr.second.size());
                        break;
                    case SUBDOC_COUNTER:
                        lcb_subdocspecs_counter(specs, idx++, flags, xattr.first.c_str(), xattr.first.size(),
                                                atoll(xattr.second.c_str()));
                        break;
                    default:
                        break;
                }
            }
            for (const auto &path : paths) {
                uint32_t flags = 0;
                if (o_intermediates.passed()) {
                    flags |= LCB_SUBDOCSPECS_F_MKINTERMEDIATES;
                }
                switch (m_opcode) {
                    case SUBDOC_DICT_UPSERT:
                        lcb_subdocspecs_dict_upsert(specs, idx++, flags, path.first.c_str(), path.first.size(),
                                                    path.second.c_str(), path.second.size());
                        break;
                    case SUBDOC_DICT_ADD:
                        lcb_subdocspecs_dict_add(specs, idx++, flags, path.first.c_str(), path.first.size(),
                                                 path.second.c_str(), path.second.size());
                        break;
                    case SUBDOC_REPLACE:
                        lcb_subdocspecs_replace(specs, idx++, flags, path.first.c_str(), path.first.size(),
                                                path.second.c_str(), path.second.size());
                        break;
                    case SUBDOC_ARRAY_ADD_FIRST:
                        lcb_subdocspecs_array_add_first(specs, idx++, flags, path.first.c_str(), path.first.size(),
                                                        path.second.c_str(), path.second.size());
                        break;
                    case SUBDOC_ARRAY_ADD_LAST:
                        lcb_subdocspecs_array_add_last(specs, idx++, flags, path.first.c_str(), path.first.size(),
                                                       path.second.c_str(), path.second.size());
                        break;
                    case SUBDOC_ARRAY_ADD_UNIQUE:
                        lcb_subdocspecs_array_add_unique(specs, idx++, flags, path.first.c_str(), path.first.size(),
                                                         path.second.c_str(), path.second.size());
                        break;
                    case SUBDOC_ARRAY_INSERT:
                        lcb_subdocspecs_array_insert(specs, idx++, flags, path.first.c_str(), path.first.size(),
                                                     path.second.c_str(), path.second.size());
                        break;
                    case SUBDOC_COUNTER:
                        lcb_subdocspecs_counter(specs, idx++, flags, path.first.c_str(), path.first.size(),
                                                atoll(path.second.c_str()));
                        break;
                    default:
                        break;
                }
            }
            lcb_CMDSUBDOC *cmd;
            lcb_cmdsubdoc_create(&cmd);
            lcb_cmdsubdoc_key(cmd, key.c_str(), key.size());
            lcb_cmdsubdoc_specs(cmd, specs);
            if (o_upsert.passed()) {
                lcb_cmdsubdoc_store_semantics(cmd, LCB_SUBDOC_STORE_UPSERT);
            }
            if (o_expiry.passed()) {
                lcb_cmdsubdoc_expiry(cmd, o_expiry.result());
            }
            err = lcb_subdoc(instance, this, cmd);
            lcb_subdocspecs_destroy(specs);
            lcb_cmdsubdoc_destroy(cmd);
            if (err != LCB_SUCCESS) {
                throw LcbError(err, "Failed to schedule " + cmdname + " command");
            }
        }
        lcb_sched_leave(instance);

        err = lcb_wait(instance, LCB_WAIT_DEFAULT);
        if (err != LCB_SUCCESS) {
            throw LcbError(err, "Failed to execute " + cmdname + " command");
        }
    }

  protected:
    SubdocOperation m_opcode;
    const char *m_description;

    cliopts::PairListOption o_paths;
    cliopts::PairListOption o_xattrs;
    cliopts::UIntOption o_expiry;
    cliopts::BoolOption o_intermediates;
    cliopts::BoolOption o_upsert;

    bool m_enable_intermediates;
};

class HelpHandler : public Handler
{
  public:
    HANDLER_DESCRIPTION("Show help")
    HelpHandler() : Handler("help") {}

  protected:
    void run() override
    {
        fprintf(stderr, "Usage: <command> [options]\n");
        fprintf(stderr, "command may be:\n");
        for (const char **cur = handlers_sorted; *cur; cur++) {
            const Handler *handler = handlers[*cur];
            fprintf(stderr, "   %-20s", *cur);
            fprintf(stderr, "%s\n", handler->description());
        }
    }
};

class DumpHandler : public Handler
{
  public:
    HANDLER_DESCRIPTION("Dump metrics and internal state of library")
    DumpHandler() : Handler("dump") {}

  protected:
    void run() override
    {
        lcb_METRICS *metrics = nullptr;
        size_t ii;

        lcb_dump(instance, stderr, LCB_DUMP_ALL);
        lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_METRICS, &metrics);

        if (metrics) {
            fprintf(stderr, "%p: nsrv: %d, retried: %lu\n", (void *)instance, (int)metrics->nservers,
                    (unsigned long)metrics->packets_retried);
            for (ii = 0; ii < metrics->nservers; ii++) {
                fprintf(stderr, "  [srv-%d] snt: %lu, rcv: %lu, q: %lu, err: %lu, tmo: %lu, nmv: %lu, orph: %lu\n",
                        (int)ii, (unsigned long)metrics->servers[ii]->packets_sent,
                        (unsigned long)metrics->servers[ii]->packets_read,
                        (unsigned long)metrics->servers[ii]->packets_queued,
                        (unsigned long)metrics->servers[ii]->packets_errored,
                        (unsigned long)metrics->servers[ii]->packets_timeout,
                        (unsigned long)metrics->servers[ii]->packets_nmv,
                        (unsigned long)metrics->servers[ii]->packets_ownerless);
            }
        }
    }
};
} // namespace subdoc

static void setupHandlers()
{
    handlers["help"] = new subdoc::HelpHandler();
    handlers["dump"] = new subdoc::DumpHandler();
    handlers["get"] = new subdoc::LookupHandler("get", SUBDOC_GET, "Retrieve path from the item on the server");
    handlers["exists"] =
        new subdoc::LookupHandler("exists", SUBDOC_EXISTS, "Check if path exists in the item on the server");
    handlers["exist"] = handlers["exists"];
    handlers["remove"] = new subdoc::RemoveHandler();
    handlers["delete"] = handlers["remove"];
    handlers["upsert"] = new subdoc::UpsertHandler();
    handlers["set"] = handlers["upsert"];
    handlers["dict-upsert"] =
        new subdoc::MutationHandler("dict-upsert", SUBDOC_DICT_UPSERT, "Unconditionally set the value at the path");
    handlers["dict-add"] = new subdoc::MutationHandler(
        "dict-add", SUBDOC_DICT_ADD, "Add the value at the given path, if the given path does not exist");
    handlers["replace"] =
        new subdoc::MutationHandler("replace", SUBDOC_REPLACE, "Replace the value at the specified path", false);
    handlers["array-add-first"] =
        new subdoc::MutationHandler("array-add-first", SUBDOC_ARRAY_ADD_FIRST, "Prepend the value(s) to the array");
    handlers["array-add-last"] =
        new subdoc::MutationHandler("array-add-last", SUBDOC_ARRAY_ADD_LAST, "Append the value(s) to the array");
    handlers["array-add-unique"] = new subdoc::MutationHandler(
        "array-add-unique", SUBDOC_ARRAY_ADD_UNIQUE,
        "Add the value to the array indicated by the path, if the value is not already in the array");
    handlers["array-insert"] = new subdoc::MutationHandler(
        "array-insert", SUBDOC_ARRAY_INSERT,
        "Add the value at the given array index. Path must include index, e.g. `my.list[4]`");
    handlers["counter"] = new subdoc::MutationHandler(
        "counter", SUBDOC_COUNTER, "Increment or decrement an existing numeric path. The value must be 64-bit integer");
    handlers["size"] =
        new subdoc::LookupHandler("size", SUBDOC_GET_COUNT, "Count the number of elements in an array or dictionary");
    handlers["get-count"] = handlers["size"];
}

static void cleanup()
{
    handlers["exists"] = nullptr;
    handlers["delete"] = nullptr;
    handlers["set"] = nullptr;
    handlers["get-count"] = nullptr;

    for (auto &handler : handlers) {
        delete handler.second;
    }

    if (instance) {
        if (config.shouldDump()) {
            lcb_dump(instance, stderr, LCB_DUMP_ALL);
        }
        if (config.useTimings()) {
            hg.write();
        }
        if (instance) {
            lcb_destroy(instance);
        }
    }
}

static void real_main(int argc, char **argv)
{
    std::string history_path = ConnParams::getUserHome() + CBCSUBDOC_HISTORY_FILENAME;
    Parser parser;

    config.addToParser(parser);
    parser.parse(argc, argv);
    config.processOptions();

    lcb_CREATEOPTS *cropts = nullptr;
    config.fillCropts(cropts);
    do_or_die(lcb_create(&instance, cropts), "Failed to create connection");
    lcb_createopts_destroy(cropts);
    config.doCtls();
    do_or_die(lcb_connect(instance), "Failed to connect to cluster");
    do_or_die(lcb_wait(instance, LCB_WAIT_DEFAULT), "Failed to wait for connection bootstrap");
    do_or_die(lcb_get_bootstrap_status(instance), "Failed to bootstrap");
    if (config.useTimings()) {
        hg.install(instance, stdout);
    }
    {
        int activate = 1;
        lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_METRICS, &activate);
    }
    setupHandlers();
    std::atexit(cleanup);
    lcb_install_callback(instance, LCB_CALLBACK_SDLOOKUP, (lcb_RESPCALLBACK)subdoc_callback);
    lcb_install_callback(instance, LCB_CALLBACK_SDMUTATE, (lcb_RESPCALLBACK)subdoc_callback);

    linenoiseSetCompletionCallback(command_completion);
    linenoiseSetMultiLine(1);
    linenoiseHistoryLoad(history_path.c_str());

    do {
        char *line = linenoise("subdoc> ");
        if (line == nullptr) {
            break;
        }
        if (line[0] != '\0') {
            linenoiseHistoryAdd(line);
            linenoiseHistorySave(history_path.c_str());

            int cmd_argc = 0;
            char **cmd_argv = nullptr;
            int rv = cliopts_split_args(line, &cmd_argc, &cmd_argv);
            if (rv) {
                fprintf(stderr, "Invalid input: unterminated single quote\n");
            } else {
                if (cmd_argc > 0) {
                    char *cmd_name = cmd_argv[0];
                    subdoc::Handler *handler = handlers[cmd_name];
                    if (handler == nullptr) {
                        fprintf(stderr, "Unknown command %s\n", cmd_name);
                        subdoc::HelpHandler().execute(cmd_argc, cmd_argv);
                    } else {
                        try {
                            handler->execute(cmd_argc, cmd_argv);
                        } catch (std::exception &err) {
                            fprintf(stderr, "%s\n", err.what());
                        }
                    }
                    free(cmd_argv);
                }
            }
        }
        free(line);
    } while (true);
}

int main(int argc, char **argv)
{
    try {
        real_main(argc, argv);
        return 0;
    } catch (std::exception &exc) {
        std::cerr << exc.what() << std::endl;
        exit(EXIT_FAILURE);
    }
}
