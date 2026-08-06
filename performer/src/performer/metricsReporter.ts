import { exec } from "child_process";
import { ServerWritableStream } from "@grpc/grpc-js";
import { Result as MetricsResultPb } from "../proto/metrics.top_level_pb";
import {
  Request as RequestPb,
  Result as ResultPb,
} from "../proto/run.top_level_pb";

import { SdkUtils } from "./utils";

export class MetricsReporter {
  private readonly _interval: number;
  private readonly _runId: string;
  private readonly _call: ServerWritableStream<RequestPb, ResultPb>;
  private _reporterInitialized: boolean;
  private _lastReport: number;
  private _lastProcCpu: NodeJS.CpuUsage;
  private _lastCpuPercent: number;
  private _lastRssMb: number;
  private _numThreads: number;
  private _timerId: NodeJS.Timeout | undefined;

  constructor(
    call: ServerWritableStream<RequestPb, ResultPb>,
    interval = 1000,
    runId = "",
  ) {
    this._call = call;
    this._interval = interval;
    this._runId = runId;
    this._reporterInitialized = false;
    this._lastReport = 0;
    this._lastProcCpu = { user: 0, system: 0 };
    this._lastCpuPercent = 0;
    this._lastRssMb = 0;
    this._numThreads = 0;
  }

  _calcProcCpuPercent(
    t1: NodeJS.CpuUsage,
    t2: NodeJS.CpuUsage,
    timeDelta: number,
  ): number {
    if (timeDelta === 0) {
      return 0;
    }

    // convert deltaCpu to milliseconds
    const deltaCpu = (t2.user - t1.user + (t2.system - t1.system)) / 1000;
    return (deltaCpu / timeDelta) * 100;
  }

  _setThreadCount(output: string, expectedColumns: number): void {
    const lines = output.split("\n");
    let numThreads = 0;
    // skip the first line (header)
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(/\s+/);
      if (parts.length < expectedColumns) {
        continue;
      }
      numThreads++;
    }

    this._numThreads = numThreads;
  }

  _reportMetrics(): void {
    const report = JSON.stringify({
      processCpu: this._lastCpuPercent.toFixed(2),
      memRssUsedMB: this._lastRssMb.toFixed(2),
      threadCount: this._numThreads,
    });

    console.log(`Metrics (run: ${this._runId}): ${report}`);
    const initiated = SdkUtils.getInitiated();
    const metricsResult = new MetricsResultPb();
    metricsResult.setMetrics(report);
    metricsResult.setInitiated(initiated);
    const result = new ResultPb();
    result.setMetrics(metricsResult);
    // As requestExecutor.sendResultToDriver() has the ability to call the 'drain' event
    // on the stream, we _should_ be okay to call write() and not worry about the 'drain' event
    // when sending metrics to the server.
    this._call.write(result);
  }

  /*
   * Get the number of threads for the given process id.  Using this method
   * allows for us to have insight into the number of threads being used by
   * the Node.js process (also includes the threads in the V8 and libuv threadpools).
   * Uses the `ps` command MacOS and Linux
   */
  _getThreads(processId: number): void {
    if (process.platform === "darwin") {
      // does not seem to matter if we provide:  -o %cpu,rss,vsz,args
      // the other headers listed below are always returned
      // header row:
      // USER         PID   TT   %CPU STAT PRI     STIME     UTIME COMMAND
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      exec(`ps -M -h -p ${processId}`, (err, stdout, _) => {
        if (err) {
          throw err;
        }
        // we expect at least: PID, %CPU, STAT, PRI, STIME & UTIME
        this._setThreadCount(stdout, 6);
        this._reportMetrics();
      });
    } else if (process.platform === "linux") {
      // header rows:
      // %CPU RSS VSZ COMMAND
      exec(
        `ps H --headers -p ${processId} -o %cpu,rss,vsz,args`,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        (err, stdout, _) => {
          if (err) {
            throw err;
          }
          this._setThreadCount(stdout, 4);
          this._reportMetrics();
        },
      );
    } else {
      console.error("Unsupported platform: ", process.platform);
    }
  }

  computeMetrics(): void {
    const now = performance.now();
    const procCpu = process.cpuUsage();

    if (!this._reporterInitialized) {
      this._reporterInitialized = true;
      this._lastReport = now;
      this._lastProcCpu = procCpu;
      return;
    }
    const timeDelta = now - this._lastReport; // in milliseconds
    const cpuPercent = this._calcProcCpuPercent(
      this._lastProcCpu,
      procCpu,
      timeDelta,
    );
    const rssMb = process.memoryUsage.rss() / (1024 * 1024); // to MB
    this._lastReport = now;
    this._lastProcCpu = procCpu;
    this._lastCpuPercent = cpuPercent;
    this._lastRssMb = rssMb;
    // we pass the metrics data to the parent in the callback of _getThreads()
    this._getThreads(process.pid);
  }

  start(): void {
    console.log(`Starting metrics reporter (run: ${this._runId}).`);
    this._timerId = setInterval(this.computeMetrics.bind(this), this._interval);
  }

  stop(): void {
    console.log(`Stopping metrics reporter (run: ${this._runId}).`);
    clearInterval(this._timerId);
  }
}
