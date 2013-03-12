/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
#ifndef COUCHNODE_OPERATIONS_H
#define COUCHNODE_OPERATIONS_H 1
#ifndef COUCHBASE_H
#error "Include couchbase.h before including this file"
#endif

#include <cstdlib>
#include <sstream>

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

        /**
         * Try to get the key from an object.
         *
         * If the object is a string then this should be the key,
         * but if it is a map it may contain key and hashkey
         *
         * The function throws an error upon error
         */
        virtual void getKey(const v8::Handle<v8::Value> &val,
                            char * &key, size_t &nkey,
                            char * &hashkey, size_t &nhashkey);
    };

    class StoreOperation : public Operation {
    public:
        StoreOperation() : cmd(), cookie(NULL) { }
        virtual ~StoreOperation() {
            delete [](char*)cmd.v.v0.key;
            delete [](char*)cmd.v.v0.hashkey;
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
                delete [](char*)cmds[ii]->v.v0.hashkey;
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

    class GetAndLockOperation : public Operation {
    public:
        GetAndLockOperation() : numCommands(0), cmds(NULL), cookie(NULL) {}
        virtual ~GetAndLockOperation() {
            for (int ii = 0; ii < numCommands; ++ii) {
                delete [](char*)cmds[ii]->v.v0.key;
                delete [](char*)cmds[ii]->v.v0.hashkey;
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

    class UnlockOperation : public Operation {
    public:
        UnlockOperation() : numCommands(0), cmds(NULL), cookie(NULL) {}
        virtual ~UnlockOperation() {
            for (int ii = 0; ii < numCommands; ++ii) {
                delete [](char*)cmds[ii]->v.v0.key;
                delete [](char*)cmds[ii]->v.v0.hashkey;
            }
            delete []cmds;
        }

        virtual void parse(const v8::Arguments &arguments);

        virtual lcb_error_t execute(lcb_t instance) {
            return lcb_unlock(instance, cookie, numCommands, cmds);
        }

        virtual void cancel(lcb_error_t err) {
            for (int ii = 0; ii < numCommands; ++ii) {
                cookie->result(err, cmds[ii]->v.v0.key, cmds[ii]->v.v0.nkey);
            }
        }

    private:
        int numCommands;
        lcb_unlock_cmd_t ** cmds;
        CouchbaseCookie *cookie;
    };

    class TouchOperation : public Operation {
    public:
        TouchOperation() : cmd(), cookie(NULL) {}
        virtual ~TouchOperation() {
            delete [](char*)cmd.v.v0.key;
            delete [](char*)cmd.v.v0.hashkey;
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
            delete [](char*)cmd.v.v0.hashkey;
        }

        virtual void parse(const v8::Arguments &arguments);

        lcb_error_t execute(lcb_t instance) {
            const lcb_observe_cmd_t * const cmds[] = { &cmd };
            lcb_error_t ret = lcb_observe(instance, cookie, 1, cmds);
            return ret;
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
            delete [](char*)cmd.v.v0.hashkey;
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
            delete [](char*)cmd.v.v0.hashkey;
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

    class HttpOperation : public Operation {

    protected:
        HttpOperation() : cmd(), cookie(NULL) {
            cmd.v.v0.content_type = "application/json";
        }

        lcb_error_t execute(lcb_t instance) {
            cmd.v.v0.path = strdup(path.str().c_str());
            cmd.v.v0.npath = path.str().length();
            cmd.v.v0.body = strdup(body.c_str());
            cmd.v.v0.nbody = body.length();

            return lcb_make_http_request(instance, cookie,
                                         LCB_HTTP_TYPE_VIEW, &cmd, NULL);
        }

        virtual void cancel(lcb_error_t err) {
            cookie->result(err, (const lcb_http_resp_t *)NULL);
        }
     protected:
        std::stringstream path;
        std::string body;
        lcb_http_cmd_t cmd;
        CouchbaseCookie *cookie;
    };

    class GetDesignDocOperation : public HttpOperation {
    public:
        GetDesignDocOperation() : HttpOperation() {
            cmd.v.v0.method = LCB_HTTP_METHOD_GET;
        }
        virtual void parse(const v8::Arguments &arguments);
    };

    /**
     * The only difference between get and delete of design doc
     * is the HTTP method being used.
     */
    class DeleteDesignDocOperation : public GetDesignDocOperation {
    public:
        DeleteDesignDocOperation() : GetDesignDocOperation() {
            cmd.v.v0.method = LCB_HTTP_METHOD_DELETE;
        }
    };

    class SetDesignDocOperation : public HttpOperation {
    public:
        SetDesignDocOperation() : HttpOperation() {
            cmd.v.v0.method = LCB_HTTP_METHOD_PUT;
        }
        virtual void parse(const v8::Arguments &arguments);
    };

    class ViewOperation : public HttpOperation {
    public:
        ViewOperation() : HttpOperation() {
            cmd.v.v0.method = LCB_HTTP_METHOD_GET;
        }
        virtual void parse(const v8::Arguments &arguments);
    };

} // namespace Couchnode

#endif
