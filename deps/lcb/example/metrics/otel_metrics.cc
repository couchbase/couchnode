/*
 *     Copyright 2021 Couchbase, Inc.
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

/**
 *  for default metrics:  LCB_LOGLEVEL=2 ./otel_metrics <anything>
 *  for otel metrics ./otel_metrics
 */

#include <atomic>
#include <csignal>
#include <iostream>

#include <opentelemetry/exporters/ostream/metrics_exporter.h>
#include <opentelemetry/metrics/provider.h>
#include <opentelemetry/sdk/metrics/controller.h>
#include <opentelemetry/sdk/metrics/meter.h>
#include <opentelemetry/sdk/metrics/meter_provider.h>
#include <opentelemetry/sdk/metrics/ungrouped_processor.h>
#include <opentelemetry/metrics/sync_instruments.h>

#include <libcouchbase/couchbase.h>
#include <libcouchbase/utils.h>
#include "internal.h"

namespace sdkmetrics = opentelemetry::sdk::metrics;
namespace apimetrics = opentelemetry::metrics;
namespace nostd = opentelemetry::nostd;

std::atomic<bool> running{true};

nostd::shared_ptr<metrics_api::ValueRecorder<int>> counter;

void signal_handler(int /* signal */)
{
    running = false;
}

static void check(const char *msg, lcb_STATUS err)
{
    if (err != LCB_SUCCESS) {
        std::cerr << msg << ". Error " << lcb_strerror_short(err) << std::endl;
        exit(1);
    }
}

static void store_callback(lcb_INSTANCE *, int cbtype, const lcb_RESPSTORE *resp)
{
    check(lcb_strcbtype(cbtype), lcb_respstore_status(resp));
}

static void get_callback(lcb_INSTANCE *, int cbtype, const lcb_RESPGET *resp)
{
    check(lcb_strcbtype(cbtype), lcb_respget_status(resp));
}

static void row_callback(lcb_INSTANCE *, int cbtype, const lcb_RESPQUERY *resp)
{
    check(lcb_strcbtype(cbtype), lcb_respquery_status(resp));
}

static void open_callback(lcb_INSTANCE *, lcb_STATUS rc)
{
    check("open bucket", rc);
}

struct otel_recorder {
    nostd::shared_ptr<apimetrics::BoundValueRecorder<int>> recorder;
};

void record_callback(const lcbmetrics_VALUERECORDER *recorder, uint64_t val)
{
    otel_recorder *ot = nullptr;
    lcbmetrics_valuerecorder_cookie(recorder, reinterpret_cast<void **>(&ot));
    // the value is the latency, in ns.  Lets report in us throughout.
    ot->recorder->record(val / 1000);
}

void record_dtor(const lcbmetrics_VALUERECORDER *recorder)
{
    otel_recorder *ot = nullptr;
    lcbmetrics_valuerecorder_cookie(recorder, reinterpret_cast<void **>(&ot));
    delete ot;
}

static const lcbmetrics_VALUERECORDER *new_recorder(const lcbmetrics_METER *meter, const char *name,
                                                    const lcbmetrics_TAG *tags, size_t ntags)
{
    nostd::shared_ptr<metrics_api::Meter> *ot_meter = nullptr;

    lcbmetrics_meter_cookie(meter, reinterpret_cast<void **>(&ot_meter));

    // convert the tags array to a map for the KeyValueIterableView
    std::map<std::string, std::string> keys;
    for (int i = 0; i < ntags; i++) {
        keys[tags[i].key] = tags[i].value;
    }
    auto *ot = new otel_recorder();
    if (!counter) {
        counter = (*ot_meter)->NewIntValueRecorder(name, "oltp_metrics example", "us", true);
    }
    ot->recorder = counter->bindValueRecorder(opentelemetry::common::KeyValueIterableView<decltype(keys)>{keys});

    lcbmetrics_VALUERECORDER *recorder;
    lcbmetrics_valuerecorder_create(&recorder, static_cast<void *>(ot));
    lcbmetrics_valuerecorder_record_value_callback(recorder, record_callback);
    lcbmetrics_valuerecorder_dtor_callback(recorder, record_dtor);
    return recorder;
}

int main(int argc, char *argv[])
{
    // Initialize and set the global MeterProvider
    auto provider = nostd::shared_ptr<metrics_api::MeterProvider>(new sdkmetrics::MeterProvider);

    // Create a new Meter from the MeterProvider
    nostd::shared_ptr<metrics_api::Meter> ot_meter = provider->GetMeter("Test", "0.1.0");

    // Create the controller with Stateless Metrics Processor
    // NOTE: the default meter has limited aggregator choices. No histograms, which
    // would be nice for log output.
    sdkmetrics::PushController controller(
        ot_meter,
        std::unique_ptr<sdkmetrics::MetricsExporter>(new opentelemetry::exporter::metrics::OStreamMetricsExporter),
        std::shared_ptr<sdkmetrics::MetricsProcessor>(new opentelemetry::sdk::metrics::UngroupedMetricsProcessor(true)),
        5);

    lcb_CREATEOPTS *options;
    lcb_CMDSTORE *scmd;
    lcb_CMDGET *gcmd;
    lcb_CMDQUERY *qcmd;
    lcb_INSTANCE *instance;
    lcbmetrics_METER *meter = nullptr;

    std::string connection_string = "couchbase://127.0.0.1";
    std::string username = "Administrator";
    std::string password = "password";
    std::string bucket = "default";
    std::string query = "SELECT * from `default` LIMIT 10";
    std::string opt;

    // Allow user to pass in no-otel to see default behavior
    // Ideally we will take more options, say to export somewhere other than the stderr, in the future.
    if (argc > 1) {
        opt = argv[1];
    }
    // catch sigint, and delete the external metrics...
    std::signal(SIGINT, signal_handler);

    if (opt.empty()) {
        lcbmetrics_meter_create(&meter, &ot_meter);
        lcbmetrics_meter_value_recorder_callback(meter, new_recorder);
        controller.start();
    }

    lcb_createopts_create(&options, LCB_TYPE_CLUSTER);
    lcb_createopts_connstr(options, connection_string.data(), connection_string.size());
    lcb_createopts_credentials(options, username.data(), username.size(), password.data(), password.size());
    lcb_createopts_meter(options, meter);
    check("create connection handle", lcb_create(&instance, options));
    lcb_createopts_destroy(options);

    check("schedule connect", lcb_connect(instance));
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    check("cluster bootstrap", lcb_get_bootstrap_status(instance));

    lcb_set_open_callback(instance, open_callback);
    check("schedule open bucket", lcb_open(instance, bucket.data(), bucket.size()));
    lcb_wait(instance, LCB_WAIT_DEFAULT);

    // set metrics callback if desired
    if (!opt.empty()) {
        // for default, lets set the interval low
        uint32_t interval = static_cast<uint32_t>(
            std::chrono::duration_cast<std::chrono::microseconds>(std::chrono::seconds(10)).count());
        lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_OP_METRICS_FLUSH_INTERVAL, &interval);
    }

    // enable op metrics, and set flush interval to 10 sec
    int enable = 1;
    lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_ENABLE_OP_METRICS, &enable);

    /* Assign the handlers to be called for the operation types */
    lcb_install_callback(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)get_callback);
    lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)store_callback);

    // Just loop until a sigint.  We will do an upsert, then a get, then a query.
    while (running.load()) {
        // upsert an item
        lcb_cmdstore_create(&scmd, LCB_STORE_UPSERT);
        lcb_cmdstore_key(scmd, "key", strlen("key"));
        lcb_cmdstore_value(scmd, "value", strlen("value"));
        check("schedule store", lcb_store(instance, nullptr, scmd));
        lcb_cmdstore_destroy(scmd);
        lcb_wait(instance, LCB_WAIT_DEFAULT);

        // fetch the item back
        lcb_cmdget_create(&gcmd);
        lcb_cmdget_key(gcmd, "key", strlen("key"));
        check("schedule get", lcb_get(instance, nullptr, gcmd));
        lcb_cmdget_destroy(gcmd);
        lcb_wait(instance, LCB_WAIT_DEFAULT);

        // Now, a query
        lcb_cmdquery_create(&qcmd);
        lcb_cmdquery_statement(qcmd, query.data(), query.size());
        lcb_cmdquery_callback(qcmd, row_callback);
        check("schedule query", lcb_query(instance, nullptr, qcmd));
        lcb_cmdquery_destroy(qcmd);
        lcb_wait(instance, LCB_WAIT_DEFAULT);
    }

    lcb_destroy(instance);
    controller.stop();
    return 0;
}
