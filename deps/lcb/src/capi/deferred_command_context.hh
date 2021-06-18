/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2016-2021 Couchbase, Inc.
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

#ifndef LIBCOUCHBASE_CAPI_DEFERRED_COMMAND_CONTEXT_HH
#define LIBCOUCHBASE_CAPI_DEFERRED_COMMAND_CONTEXT_HH

#include <cstddef>
#include <cstdint>

#include <mc/mcreq.h>

namespace lcb
{
/**
 * @private
 */
template <typename Command, typename Response, typename Handler>
struct deferred_command_context : mc_REQDATAEX {
    deferred_command_context(std::shared_ptr<Command> cmd, Handler &&handler, std::uint64_t start_time_ns)
        : mc_REQDATAEX(cmd->cookie(), procs_, start_time_ns), cmd_(cmd), handler_(std::move(handler))
    {
    }

    static void on_packet(struct mc_pipeline_st * /* pipeline */, struct mc_packet_st *pkt,
                          lcb_CALLBACK_TYPE /* cbtype */, lcb_STATUS rc, const void *res)
    {
        auto *ctx = static_cast<deferred_command_context<Command, Response, Handler> *>(pkt->u_rdata.exdata);
        ctx->handler_(rc, static_cast<const Response *>(res), std::move(ctx->cmd_));
        delete ctx;
    }
    static void on_failure(struct mc_packet_st *pkt)
    {
        auto *ctx = static_cast<deferred_command_context<Command, Response, Handler> *>(pkt->u_rdata.exdata);
        ctx->handler_(LCB_ERR_SHEDULE_FAILURE, nullptr, std::move(ctx->cmd_));
        delete ctx;
    }

  private:
    const mc_REQDATAPROCS procs_{on_packet, on_failure};
    std::shared_ptr<Command> cmd_;
    Handler handler_;
};

template <typename Command, typename Response, typename Handler>
deferred_command_context<Command, Response, Handler> *
make_deferred_command_context(std::shared_ptr<Command> cmd, Handler &&handler,
                              std::uint64_t start_time_ns = gethrtime())
{
    return new deferred_command_context<Command, Response, Handler>(cmd, std::move(handler), start_time_ns);
}

} // namespace lcb

#endif // LIBCOUCHBASE_CAPI_DEFERRED_COMMAND_CONTEXT_HH
