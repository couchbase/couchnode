/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2013 Couchbase, Inc.
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

#ifndef COUCHNODE_COMMANDS_H
#define COUCHNODE_COMMANDS_H 1
#ifndef COUCHBASE_H
#error "Include couchbase.h before including this file"
#endif

#include "buflist.h"
#include "commandoptions.h"
#include <cstdio>
namespace Couchnode {
using namespace v8;


enum ArgMode {
    ARGMODE_SIMPLE = 0x0,
    ARGMODE_MULTI = 0x2,
};


#define CTOR_COMMON(cls) \
        cls(const Arguments &args, int mode) : Command(args, mode) {}


class KeysInfo
{
public:
    typedef enum { ArrayKeys, ObjectKeys, SingleKey } KeysType;
    KeysInfo() : kcollType(SingleKey), isPersistent(false), ncmds(0) {}
    ~KeysInfo();

    unsigned int size() const { return ncmds; }
    void setKeys(Handle<Value> k);
    KeysType getType() const { return kcollType; }
    Handle<Value> getKeys() { return keys; }

    // Provides a "safe" keys array that is guaranteed not to be modified. This
    // is potentially a fairly expensive function and should only be called on
    // error conditions.
    Handle<Array> getSafeKeysArray();

    // Makes the keys persistent
    void makePersistent();

private:
    Handle<Value> keys;
    KeysType kcollType;
    bool isPersistent;
    unsigned int ncmds;
};

class CommandKey
{
public:
    void setKeys(Handle<Value> o, const char *k, size_t nk,
                 const char *hk = NULL, size_t nhk = 0) {
        object = o;
        key = k;
        nkey = nk;
        hashkey = hk;
        nhashkey = nhk;
    }

    template <typename T>
    void setKeyV0(T *cmd) {
        cmd->v.v0.key = key;
        cmd->v.v0.nkey = nkey;
        cmd->v.v0.hashkey = hashkey;
        cmd->v.v0.nhashkey = nhashkey;
    }

    const char *getKey() const { return key; }
    size_t getKeySize() const { return nkey; }
    Handle<Value> getObject() const { return object; }


private:
    Handle<Value> object;
    const char *key;
    size_t nkey;
    const char *hashkey;
    size_t nhashkey;
};

class Command
{
public:
    /**
     * This callback is passed to the handler for each operation. It receives
     * the following:
     * @param cmd the command context itself. This is prototyped as Command but
     *  will always be a subclass
     * @param k, n an allocated key and size specifier. These *must* be assigned
     *  first before anything, If an error occurrs, the CommandList implementation
     *  shall free it
     * @param dv a specific value for the command itself.. this is set to NULL
     *  unless the keys was an object itself.
     */
    typedef bool (*ItemHandler)(Command *cmd,
                                CommandKey &ki,
                                Handle<Value> dv,
                                unsigned int ix);


    Command(const Arguments& args, int cmdMode) : apiArgs(args) {
        mode = cmdMode;
        cookie = NULL;
    }

    virtual ~Command() {

    }

    virtual bool initialize();
    virtual lcb_error_t execute(lcb_t) = 0;

    // Process and validate all commands, and convert them into LCB commands
    bool process(ItemHandler handler);
    bool process() { return process(getHandler()); }

    // Get the exception object, if present
    CBExc &getError() { return err; }

    virtual Cookie *createCookie();
    Cookie *getCookie() { return cookie; }

    // Make this command object persist across multiple operations.
    // this means, among other things, that any required local values
    // now become persistent, and that the returned object is now located
    // on malloc's heap (and may be deleted)
    Command *makePersistent();
    void detachCookie() { cookie = NULL; }

    Handle<Array> getKeyList() {
        return keys.getSafeKeysArray();
    }

protected:
    bool getBufBackedString(Handle<Value> v, char **k, size_t *n,
                            bool addNul = false);
    bool parseCommonOptions(const Handle<Object>);
    virtual Parameters* getParams() = 0;
    virtual bool initCommandList() = 0;
    virtual ItemHandler getHandler() const = 0;
    virtual Command* copy() = 0;
    virtual const char *getDefaultString() const { return NULL; }
    void initCookie();
    void setCookieKeyOption(Handle<Value> key, Handle<Value> option);
    Command(Command &other);

    const Arguments& apiArgs;
    NAMED_OPTION(SpooledOption, BooleanOption, SPOOLED);
    NAMED_OPTION(HashkeyOption, StringOption, HASHKEY);


    // Callback parameters..
    SpooledOption isSpooled;
    CallableOption callback;
    HashkeyOption globalHashkey;

    Cookie *cookie;

    CBExc err;
    KeysInfo keys;
    BufferList bufs;

    // Per-key options
    // these are transferred over to the the cookie when needed
    Handle<Object> cookieKeyOptions;


    // Set by subclasses:
    int mode; // MODE_* | MODE_* ...

private:

    bool processObject(Handle<Object>);
    bool processArray(Handle<Array>);
    bool processSingle(Handle<Value>, Handle<Value>, unsigned int);
    bool handleBadString(const char *msg, char **k, size_t *n);
};

class GetCommand : public Command
{

public:
    CTOR_COMMON(GetCommand)
    lcb_error_t execute(lcb_t);
    static bool handleSingle(Command *,
                             CommandKey&, Handle<Value>, unsigned int);

    virtual Command* copy() { return new GetCommand(*this); }

protected:
    Parameters* getParams() { return &globalOptions; }
    GetOptions globalOptions;
    CommandList<lcb_get_cmd_t> commands;
    ItemHandler getHandler() const { return handleSingle; }
    virtual bool initCommandList() {
        return commands.initialize(keys.size());
    }
};

class LockCommand : public GetCommand
{
public:
    LockCommand(const Arguments& origArgs, int mode)
        : GetCommand(origArgs, mode) {
    }

    bool initialize() {
        if (!GetCommand::initialize()) {
            return false;
        }
        globalOptions.lockTime.forceIsFound();
        return true;
    }
};


class StoreCommand : public Command
{
public:
    StoreCommand(const Arguments& origArgs, lcb_storage_t sop, int mode)
        : Command(origArgs, mode), op(sop) { }

    static bool handleSingle(Command*, CommandKey&,
                             Handle<Value>, unsigned int);

    lcb_error_t execute(lcb_t);
    virtual Command* copy() { return new StoreCommand(*this); }

protected:
    lcb_storage_t op;
    CommandList<lcb_store_cmd_t> commands;
    StoreOptions globalOptions;
    ItemHandler getHandler() const { return handleSingle; }
    Parameters* getParams() { return &globalOptions; }
    virtual bool initCommandList() {
        return commands.initialize(keys.size());
    }
};

class UnlockCommand : public Command
{
public:
    CTOR_COMMON(UnlockCommand)
    virtual Command *copy() { return new UnlockCommand(*this); }
    lcb_error_t execute(lcb_t);

protected:
    static bool handleSingle(Command *, CommandKey&,
                             Handle<Value>, unsigned int);
    CommandList<lcb_unlock_cmd_t> commands;
    UnlockOptions globalOptions;
    ItemHandler getHandler() const { return handleSingle; }
    Parameters * getParams() { return &globalOptions; }
    virtual bool initCommandList() {
        return commands.initialize(keys.size());
    }
};

class TouchCommand : public Command
{
public:
    TouchCommand(const Arguments& origArgs, int mode)
        : Command(origArgs, mode) { }
    static bool handleSingle(Command *, CommandKey&,
                             Handle<Value>, unsigned int);
    lcb_error_t execute(lcb_t);
    virtual Command *copy() { return new TouchCommand(*this); }

protected:
    CommandList<lcb_touch_cmd_t> commands;
    TouchOptions globalOptions;
    ItemHandler getHandler() const { return handleSingle; }
    Parameters* getParams() { return &globalOptions; }
    virtual bool initCommandList() {
        return commands.initialize(keys.size());
    }
};

class ArithmeticCommand : public Command
{

public:
    CTOR_COMMON(ArithmeticCommand)
    lcb_error_t execute(lcb_t);
    Command * copy() { return new ArithmeticCommand(*this); }
protected:
    static bool handleSingle(Command *, CommandKey&,
                             Handle<Value>, unsigned int);
    CommandList<lcb_arithmetic_cmd_t> commands;
    ArithmeticOptions globalOptions;
    ItemHandler getHandler() const { return handleSingle; }
    Parameters* getParams() { return &globalOptions; }
    virtual bool initCommandList() {
        return commands.initialize(keys.size());
    }
};


class DeleteCommand : public Command
{
public:
    CTOR_COMMON(DeleteCommand)
    lcb_error_t execute(lcb_t);
    Command *copy() { return new DeleteCommand(*this); }

protected:
    static bool handleSingle(Command *, CommandKey&,
                             Handle<Value>, unsigned int);
    CommandList<lcb_remove_cmd_t> commands;
    DeleteOptions globalOptions;
    ItemHandler getHandler() const { return handleSingle; }
    Parameters * getParams() { return &globalOptions; }
    virtual bool initCommandList() {
        return commands.initialize(keys.size());
    }
};

class ObserveCommand : public Command
{
public:
    CTOR_COMMON(ObserveCommand)
    lcb_error_t execute(lcb_t);
    Command *copy() { return new ObserveCommand(*this); }
    virtual Cookie *createCookie();

protected:
    CommandList<lcb_observe_cmd_t> commands;
    static bool handleSingle(Command *, CommandKey&,
                             Handle<Value>, unsigned int);
    ItemHandler getHandler() const { return handleSingle; }
    Parameters *getParams() { return NULL; } // nothing special
    virtual bool initCommandList() {
        return commands.initialize(keys.size());
    }
};

class EndureCommand : public Command
{
public:
    CTOR_COMMON(EndureCommand)
    lcb_error_t execute(lcb_t);
    Command *copy() { return new EndureCommand(*this); };

protected:
    CommandList<lcb_durability_cmd_t> commands;
    DurabilityOptions globalOptions;
    Parameters *getParams() { return &globalOptions; }

    static bool handleSingle(Command *, CommandKey&,
                             Handle<Value>, unsigned int);
    ItemHandler getHandler() const { return handleSingle; }
    virtual bool initCommandList() {
        return commands.initialize(keys.size());
    }
};

class StatsCommand : public Command
{
public:
    CTOR_COMMON(StatsCommand)
    lcb_error_t execute(lcb_t);
    virtual Cookie* createCookie();

protected:
    CommandList<lcb_server_stats_cmd_t> commands;
    static bool handleSingle(Command *, CommandKey&,
                             Handle<Value>, unsigned int);
    Parameters *getParams() { return NULL; }
    ItemHandler getHandler() const { return handleSingle; }
    virtual bool initCommandList() {
        return commands.initialize(1);
    }

    virtual const char * getDefaultString() const {
        return "";
    }

    Command *copy() { return new StatsCommand(*this); }
};

// For now, this will just be a simple wrapper around lcb_make_htt
class HttpCommand : public Command
{
public:
    CTOR_COMMON(HttpCommand);
    lcb_error_t execute(lcb_t);
    virtual Cookie *createCookie();

protected:
    CommandList<lcb_http_cmd_t> commands;
    lcb_http_type_t htType;
    HttpOptions globalOptions;

    static bool handleSingle(Command *, CommandKey&,
                             Handle<Value>, unsigned int);

    ItemHandler getHandler() const { return handleSingle; }
    Parameters *getParams() { return &globalOptions; }
    virtual bool initCommandList() { return commands.initialize(1); }
    virtual const char * getDefaultString() const { return ""; }
    Command *copy() { return new HttpCommand(*this); }
};

}

#endif
