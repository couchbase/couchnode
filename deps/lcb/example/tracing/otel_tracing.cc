#include <libcouchbase/couchbase.h>
#include <libcouchbase/tracing.h>

#include <opentelemetry/sdk/trace/simple_processor.h>
#include <opentelemetry/sdk/trace/tracer_provider.h>
#include <opentelemetry/trace/tracer.h>
#include <opentelemetry/exporters/ostream/span_exporter.h>
#include <cstring>
#include <string>
#include <iostream>
#include <thread>
#include <chrono>

namespace sdktrace = opentelemetry::sdk::trace;
namespace nostd = opentelemetry::nostd;

static lcbtrace_TRACER *lcbtracer = nullptr;

static void check(const std::string &msg, lcb_STATUS err)
{
    if (err != LCB_SUCCESS) {
        std::cerr << msg << ". Error " << lcb_strerror_short(err) << std::endl;
        exit(EXIT_FAILURE);
    }
}

static void store_callback(lcb_INSTANCE *, int cbtype, const lcb_RESPSTORE *resp)
{
    check(lcb_strcbtype(cbtype), lcb_respstore_status(resp));
    lcbtrace_SPAN *span;
    lcb_respstore_cookie(resp, (void **)&span);
    lcbtrace_REF ref{LCBTRACE_REF_CHILD_OF, span};
    lcbtrace_SPAN *decode_span = lcbtrace_span_start(lcbtracer, "decoding", LCBTRACE_NOW, &ref);
    std::this_thread::sleep_for(std::chrono::microseconds(100));
    lcbtrace_span_finish(decode_span, LCBTRACE_NOW);
    lcbtrace_span_finish(span, LCBTRACE_NOW);
}

static void get_callback(lcb_INSTANCE *, int cbtype, const lcb_RESPGET *resp)
{
    check(lcb_strcbtype(cbtype), lcb_respget_status(resp));
}

static void row_callback(lcb_INSTANCE *, int cbtype, const lcb_RESPQUERY *resp)
{
    check(lcb_strcbtype(cbtype), lcb_respquery_status(resp));
    if (lcb_respquery_is_final(resp)) {
        lcbtrace_SPAN *span;
        lcb_respquery_cookie(resp, (void **)&span);
        lcbtrace_REF ref{LCBTRACE_REF_CHILD_OF, span};
        lcbtrace_SPAN *decode_span = lcbtrace_span_start(lcbtracer, "decoding", LCBTRACE_NOW, &ref);
        std::this_thread::sleep_for(std::chrono::microseconds(100));
        lcbtrace_span_finish(decode_span, LCBTRACE_NOW);
        lcbtrace_span_finish(span, LCBTRACE_NOW);
    }
}

static void open_callback(lcb_INSTANCE *, lcb_STATUS rc)
{
    check("open bucket", rc);
}

struct otel_span {
    nostd::shared_ptr<opentelemetry::trace::Span> span;
};

struct otel_tracer {
    nostd::shared_ptr<opentelemetry::trace::Tracer> tracer;
};

static void *start_span(lcbtrace_TRACER *tracer, const char *name, void *parent)
{
    auto ot_tracer = static_cast<otel_tracer *>(tracer->cookie)->tracer;
    auto ot_span = new otel_span();
    opentelemetry::trace::StartSpanOptions opt;
    if (nullptr != parent) {
        opt.parent = static_cast<otel_span *>(parent)->span->GetContext();
    }
    ot_span->span = ot_tracer->StartSpan(name, opt);
    return static_cast<void *>(ot_span);
}

static void end_span(void *span)
{
    static_cast<otel_span *>(span)->span->End();
}

static void destroy_span(void *span)
{
    delete static_cast<otel_span *>(span);
}

static void add_tag_string(void *span, const char *name, const char *value, size_t value_len)
{
    // extra copy :(
    std::string val;
    val.append(value, value_len);
    static_cast<otel_span *>(span)->span->SetAttribute(name, val);
}

static void add_tag_uint64(void *span, const char *name, uint64_t value)
{
    static_cast<otel_span *>(span)->span->SetAttribute(name, value);
}

int main()
{
    auto exporter = std::unique_ptr<sdktrace::SpanExporter>(new opentelemetry::exporter::trace::OStreamSpanExporter);
    auto processor = std::unique_ptr<sdktrace::SpanProcessor>(new sdktrace::SimpleSpanProcessor(std::move(exporter)));
    auto provider =
        nostd::shared_ptr<opentelemetry::trace::TracerProvider>(new sdktrace::TracerProvider(std::move(processor)));

    lcb_INSTANCE *instance;
    lcb_CREATEOPTS *options;
    lcb_CMDSTORE *scmd;
    lcb_CMDGET *gcmd;
    lcb_CMDQUERY *qcmd;

    std::string connection_string = "couchbase://127.0.0.1";
    std::string username = "Administrator";
    std::string password = "password";
    std::string bucket = "default";
    std::string query = "SELECT * FROM `default` LIMIT 10";
    std::string doc_contents = R"({"some":"thing"})";

    // setup the tracer.
    lcbtracer = lcbtrace_new(nullptr, LCBTRACE_F_EXTERNAL);
    lcbtracer->version = 1;
    lcbtracer->v.v1.start_span = start_span;
    lcbtracer->v.v1.end_span = end_span;
    lcbtracer->v.v1.destroy_span = destroy_span;
    lcbtracer->v.v1.add_tag_string = add_tag_string;
    lcbtracer->v.v1.add_tag_uint64 = add_tag_uint64;
    lcbtracer->destructor = nullptr;
    auto *ot_tracer = new otel_tracer();
    ot_tracer->tracer = provider->GetTracer("otel_tracing");
    lcbtracer->cookie = static_cast<void *>(ot_tracer);

    lcb_createopts_create(&options, LCB_TYPE_CLUSTER);
    lcb_createopts_connstr(options, connection_string.data(), connection_string.size());
    lcb_createopts_credentials(options, username.data(), username.size(), password.data(), password.size());
    lcb_createopts_tracer(options, lcbtracer);
    check("create connection handle", lcb_create(&instance, options));
    lcb_createopts_destroy(options);
    check("schedule connect", lcb_connect(instance));
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    check("cluster bootstrap", lcb_get_bootstrap_status(instance));

    lcb_set_open_callback(instance, open_callback);
    check("schedule open bucket", lcb_open(instance, bucket.data(), bucket.size()));
    lcb_wait(instance, LCB_WAIT_DEFAULT);

    lcb_install_callback(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)get_callback);
    lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)store_callback);

    auto tracer = ot_tracer->tracer;
    {
        // The span is set as parent, and is_outer.  That means our callback should close the span,
        // and it will get all the outer span attributes.
        auto outer_span = lcbtrace_span_start(lcbtracer, "outer_parent_upsert_span", LCBTRACE_NOW, nullptr);
        lcbtrace_span_set_is_outer(outer_span, true);
        // fake encoding span
        lcbtrace_REF ref{LCBTRACE_REF_CHILD_OF, outer_span};
        auto encoding_span = lcbtrace_span_start(lcbtracer, "encoding", LCBTRACE_NOW, &ref);
        lcbtrace_span_set_is_encode(encoding_span, 1);
        std::this_thread::sleep_for(std::chrono::microseconds(200));
        lcbtrace_span_finish(encoding_span, LCBTRACE_NOW);
        // now call upsert
        lcb_cmdstore_create(&scmd, LCB_STORE_UPSERT);
        lcb_cmdstore_key(scmd, "key", strlen("key"));
        lcb_cmdstore_value(scmd, doc_contents.data(), doc_contents.size());
        lcb_cmdstore_parent_span(scmd, outer_span);
        check("schedule store", lcb_store(instance, (void *)outer_span, scmd));
        lcb_cmdstore_destroy(scmd);
        lcb_wait(instance, LCB_WAIT_DEFAULT);
    }
    {
        // The span is a parent, but not is_outer.  So the span will be a parent, but there will
        // be a span created in lcb which is the outer span, with all the outer span attributes.
        auto outer_span = lcbtrace_span_start(lcbtracer, "parent_get_span", LCBTRACE_NOW, nullptr);
        lcb_cmdget_create(&gcmd);
        lcb_cmdget_key(gcmd, "key", strlen("key"));
        lcb_cmdget_parent_span(gcmd, outer_span);
        check("schedule get", lcb_get(instance, nullptr, gcmd));
        lcb_cmdget_destroy(gcmd);
        lcb_wait(instance, LCB_WAIT_DEFAULT);
        lcbtrace_span_finish(outer_span, LCBTRACE_NOW);
    }
    {
        auto external_parent = new otel_span();
        external_parent->span = provider->GetTracer("otel_tracing")->StartSpan("query_external");
        lcbtrace_SPAN *lcb_outer_wrapped_span = nullptr;
        lcbtrace_span_wrap(lcbtracer, "query_external", LCBTRACE_NOW, (void *)external_parent, &lcb_outer_wrapped_span);
        lcbtrace_span_set_is_outer(lcb_outer_wrapped_span, 1);
        // fake encoding span
        lcbtrace_REF ref{LCBTRACE_REF_CHILD_OF, lcb_outer_wrapped_span};
        auto encoding_span = lcbtrace_span_start(lcbtracer, "encoding", LCBTRACE_NOW, &ref);
        std::this_thread::sleep_for(std::chrono::microseconds(200));
        lcbtrace_span_finish(encoding_span, LCBTRACE_NOW);
        lcb_cmdquery_create(&qcmd);
        lcb_cmdquery_statement(qcmd, query.data(), query.size());
        lcb_cmdquery_callback(qcmd, row_callback);
        lcb_cmdquery_parent_span(qcmd, lcb_outer_wrapped_span);
        check("schedule query", lcb_query(instance, (void *)lcb_outer_wrapped_span, qcmd));
        lcb_cmdquery_destroy(qcmd);
        lcb_wait(instance, LCB_WAIT_DEFAULT);
    }
    lcb_destroy(instance);
    lcbtrace_destroy(lcbtracer);
    return 0;
}
