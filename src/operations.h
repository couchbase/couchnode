/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
#ifndef COUCHNODE_OPERATIONS_H
#define COUCHNODE_OPERATIONS_H 1
#ifndef COUCHBASE_H
#error "Include couchbase.h before including this file"
#endif

namespace Couchnode
{
    /**
     * This is an abstract interface for all operations.
     *   The lifecycle for the operation is that after it is created
     *   the parse() method is called for the operation to initialize
     *   itself. Then either the execute method or the cancel method
     *   is called upon the operation before it is deleted.
     */
    class Operation {
    public:
        /** Release all allocated resources */
        virtual ~Operation() {
            // The cookie is refcounted and deletes itself
        }

        /**
         * Parse the arguments for the given operation.
         * @param arguments the argument vector provided by v8
         * @throws std::string if there is a problem with one of the
         *         arguments
         */
        virtual void parse(const v8::Arguments &arguments) = 0;

        /**
         * Exeucte the operation
         * @return the error code from libcouchbase
         */
        virtual lcb_error_t execute(lcb_t instance) = 0;

        /**
         * Mark this operation as terminated with the specified
         * error code
         */
        virtual void cancel(lcb_error_t err) = 0;
    };

    class StoreOperation : public Operation {
    public:
        StoreOperation() : cmd(), cookie(NULL) { }
        virtual ~StoreOperation() {
            delete [](char*)cmd.v.v0.key;
            delete [](char*)cmd.v.v0.bytes;
        }
        virtual void parse(const v8::Arguments &arguments);

        virtual lcb_error_t execute(lcb_t instance) {
            const lcb_store_cmd_t * const cmds[] = { &cmd };
            return lcb_store(instance, cookie, 1, cmds);
        }

        virtual void cancel(lcb_error_t err) {
            cookie->result(err, cmd.v.v0.key, cmd.v.v0.nkey);
        }
     private:
        lcb_store_cmd_t cmd;
        CouchbaseCookie *cookie;
    };

    class GetOperation : public Operation {
    public:
        GetOperation() : numCommands(0), cmds(NULL), cookie(NULL) {}
        virtual ~GetOperation() {
            for (int ii = 0; ii < numCommands; ++ii) {
                delete [](char*)cmds[ii]->v.v0.key;
            }
            delete []cmds;
        }

        virtual void parse(const v8::Arguments &arguments);

        virtual lcb_error_t execute(lcb_t instance) {
            return lcb_get(instance, cookie, numCommands, cmds);
        }

        virtual void cancel(lcb_error_t err) {
            for (int ii = 0; ii < numCommands; ++ii) {
                cookie->result(err, cmds[ii]->v.v0.key, cmds[ii]->v.v0.nkey);
            }
        }

    private:
        int numCommands;
        lcb_get_cmd_t ** cmds;
        CouchbaseCookie *cookie;
    };

    class TouchOperation : public Operation {
    public:
        TouchOperation() : cmd(), cookie(NULL) {}
        virtual ~TouchOperation() {
            delete [](char*)cmd.v.v0.key;
        }
        virtual void parse(const v8::Arguments &arguments);

        lcb_error_t execute(lcb_t instance) {
            const lcb_touch_cmd_t * const cmds[] = { &cmd };
            return lcb_touch(instance, cookie, 1, cmds);
        }

        virtual void cancel(lcb_error_t err) {
            cookie->result(err, cmd.v.v0.key, cmd.v.v0.nkey);
        }
     private:
        lcb_touch_cmd_t cmd;
        CouchbaseCookie *cookie;
    };

    class ObserveOperation : public Operation {
    public:
        ObserveOperation() : cmd(), cookie(NULL) {}
        virtual ~ObserveOperation() {
            delete [](char*)cmd.v.v0.key;
        }

        virtual void parse(const v8::Arguments &arguments);

        lcb_error_t execute(lcb_t instance) {
            const lcb_observe_cmd_t * const cmds[] = { &cmd };
            return lcb_observe(instance, cookie, 1, cmds);
        }

        virtual void cancel(lcb_error_t err) {
            cookie->result(err, cmd.v.v0.key, cmd.v.v0.nkey);
        }

     private:
        lcb_observe_cmd_t cmd;
        CouchbaseCookie *cookie;
    };

    class RemoveOperation : public Operation {
    public:
        RemoveOperation() : cmd(), cookie(NULL) {}
        virtual ~RemoveOperation() {
            delete [](char*)cmd.v.v0.key;
        }

        virtual void parse(const v8::Arguments &arguments);

        lcb_error_t execute(lcb_t instance) {
            const lcb_remove_cmd_t * const cmds[] = { &cmd };
            return lcb_remove(instance, cookie, 1, cmds);
        }

        virtual void cancel(lcb_error_t err) {
            cookie->result(err, cmd.v.v0.key, cmd.v.v0.nkey);
        }

     private:
        lcb_remove_cmd_t cmd;
        CouchbaseCookie *cookie;
    };

    class ArithmeticOperation : public Operation {
    public:
        ArithmeticOperation() : cmd(), cookie(NULL) {}
        virtual ~ArithmeticOperation() {
            delete [](char*)cmd.v.v0.key;
        }

        virtual void parse(const v8::Arguments &arguments);

        lcb_error_t execute(lcb_t instance) {
            const lcb_arithmetic_cmd_t * const cmds[] = { &cmd };
            return lcb_arithmetic(instance, cookie, 1, cmds);
        }

        virtual void cancel(lcb_error_t err) {
            cookie->result(err, cmd.v.v0.key, cmd.v.v0.nkey);
        }
     private:
        lcb_arithmetic_cmd_t cmd;
        CouchbaseCookie *cookie;
    };

    class GetDesignDocOperation : public Operation {
    public:
        GetDesignDocOperation() : cmd(), cookie(NULL) {}
        virtual ~GetDesignDocOperation() {
            delete [](char*)cmd.v.v0.path;
        }

        virtual void parse(const v8::Arguments &arguments);

        lcb_error_t execute(lcb_t instance) {
            return lcb_make_http_request(instance, cookie,
                                         LCB_HTTP_TYPE_VIEW, &cmd, NULL);
        }

        virtual void cancel(lcb_error_t err) {
            cookie->result(err, (const lcb_http_resp_t *)NULL);
        }
     private:
        lcb_http_cmd_t cmd;
        CouchbaseCookie *cookie;
    };

    class SetDesignDocOperation : public Operation {
    public:
        SetDesignDocOperation() : cmd(), cookie(NULL) {}
        virtual ~SetDesignDocOperation() {
            delete [](char*)cmd.v.v0.path;
            delete [](char*)cmd.v.v0.body;
        }

        virtual void parse(const v8::Arguments &arguments);

        lcb_error_t execute(lcb_t instance) {
            return lcb_make_http_request(instance, cookie,
                                         LCB_HTTP_TYPE_VIEW, &cmd, NULL);
        }

        virtual void cancel(lcb_error_t err) {
            cookie->result(err, (const lcb_http_resp_t *)NULL);
        }
     private:
        lcb_http_cmd_t cmd;
        CouchbaseCookie *cookie;
    };

    class DeleteDesignDocOperation : public Operation {
    public:
        DeleteDesignDocOperation() : cmd(), cookie(NULL) {}
        virtual ~DeleteDesignDocOperation() {
            delete [](char*)cmd.v.v0.path;
        }

        virtual void parse(const v8::Arguments &arguments);

        lcb_error_t execute(lcb_t instance) {
            return lcb_make_http_request(instance, cookie,
                                         LCB_HTTP_TYPE_VIEW, &cmd, NULL);
        }

        virtual void cancel(lcb_error_t err) {
            cookie->result(err, (const lcb_http_resp_t *)NULL);
        }
     private:
        lcb_http_cmd_t cmd;
        CouchbaseCookie *cookie;
    };

    class ViewOperation : public Operation {
    public:
        ViewOperation() : cmd(), cookie(NULL) {}
        virtual ~ViewOperation() {
            free((void*)cmd.v.v0.path);
        }

        virtual void parse(const v8::Arguments &arguments);

        lcb_error_t execute(lcb_t instance) {
            return lcb_make_http_request(instance, cookie,
                                         LCB_HTTP_TYPE_VIEW, &cmd, NULL);
        }

        virtual void cancel(lcb_error_t err) {
            cookie->result(err, (const lcb_http_resp_t *)NULL);
        }
     private:
        lcb_http_cmd_t cmd;
        CouchbaseCookie *cookie;
    };

} // namespace Couchnode

#endif
