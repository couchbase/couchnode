/*
 *     Copyright 2016 Couchbase, Inc.
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

#ifndef LCB_MCTX_HELPER_H
#define LCB_MCTX_HELPER_H
#include <libcouchbase/couchbase.h>

namespace lcb {

class MultiCmdContext : public lcb_MULTICMD_CTX {
protected:
    virtual lcb_error_t MCTX_addcmd(const lcb_CMDBASE* cmd) = 0;
    virtual lcb_error_t MCTX_done(const void *cookie) = 0;
    virtual void MCTX_fail() = 0;

    MultiCmdContext() {
        lcb_MULTICMD_CTX::addcmd = dispatch_mctx_addcmd;
        lcb_MULTICMD_CTX::done = dispatch_mctx_done;
        lcb_MULTICMD_CTX::fail = dispatch_mctx_fail;
    }

    virtual ~MultiCmdContext() {}

private:
    static lcb_error_t dispatch_mctx_addcmd(lcb_MULTICMD_CTX* ctx, const lcb_CMDBASE * cmd) {
        return static_cast<MultiCmdContext*>(ctx)->MCTX_addcmd(cmd);
    }
    static lcb_error_t dispatch_mctx_done(lcb_MULTICMD_CTX* ctx, const void *cookie) {
        return static_cast<MultiCmdContext*>(ctx)->MCTX_done(cookie);
    }
    static void dispatch_mctx_fail(lcb_MULTICMD_CTX* ctx) {
        static_cast<MultiCmdContext*>(ctx)->MCTX_fail();
    }
};

}

#endif
