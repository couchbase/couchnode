import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, sep } from "node:path";
import { v4 as uuidv4 } from "uuid";

import { Timestamp } from "google-protobuf/google/protobuf/timestamp_pb";

import {
  Durability as DurabilityPb,
  Expiry as ExpiryPb,
  MutationState as MutationStatePb,
  MutationToken as MutationTokenPb,
  // [if:4.5.0]
  ReadPreference as ReadPreferencePb,
  // [end]
} from "../proto/shared.basic_pb";
import { Collection as CollectionPb } from "../proto/shared.collection_pb";
import {
  ContentAs as ContentAsPb,
  ContentTypes as ContentTypesPb,
} from "../proto/shared.content_pb";
import {
  Authenticator as AuthenticatorPb,
  ClusterConfig as ClusterConfigPb,
} from "../proto/shared.cluster_pb";
import {
  DocLocation as DocLocationPb,
  DocLocationPool as DocLocationPoolPb,
  DocLocationSpecific as DocLocationSpecificPb,
  DocLocationUuid as DocLocationUuidPb,
  PoolSelectionStrategyCounter as PoolSelectionStrategyCounterPb,
} from "../proto/shared.doc_location_pb";
import { Counter as CounterPb } from "../proto/shared.bounds_pb";
import { Transcoder as TranscoderPb } from "../proto/shared.transcoders_pb";

// [if:4.7.0]
import { Config as ObservabilityConfigPb } from "../proto/observability.config_pb";
import {
  LoggingMeterConfig as LoggingMeterConfigPb,
  MetricsConfig as MetricsConfigPb,
  TracingConfig as TracingConfigPb,
  ThresholdLoggingTracerConfig as ThresholdLoggingTracerConfigPb,
} from "../proto/observability.config_pb";
// [end]

import TranscoderCase = TranscoderPb.TranscoderCase;
import LocationCase = DocLocationPb.LocationCase;
import ContentAsCase = ContentAsPb.AsCase;
import AuthenticatorCase = AuthenticatorPb.AuthenticatorCase;

import {
  Authenticator,
  CertificateAuthenticator,
  PasswordAuthenticator,
  // [if:4.4.4]
  RawBinaryTranscoder,
  RawJsonTranscoder,
  RawStringTranscoder,
  // [end]
  // [if:4.5.0]
  AppTelemetryConfig,
  // [end:4.5.0]
  Cluster,
  Collection,
  ConnectOptions,
  DefaultTranscoder,
  DurabilityLevel,
  MutationState,
  MutationToken,
  // [if:4.5.0]
  ReadPreference,
  // [end]
  Transcoder,
  // [if:4.7.0]
  JwtAuthenticator,
  MetricsConfig,
  TracingConfig,
  // [end]
} from "couchbase";

import { NotImplementedError } from "./error";
import { Connection } from "./registry";
import { Counters } from "./bounds";
// [if:4.7.0]
import { IObservableConnection } from "./observability/observabilityTypes";
// [end]

type DocLocationsPb =
  | DocLocationPoolPb
  | DocLocationSpecificPb
  | DocLocationUuidPb;

interface ConnectOptionParams {
  authenticator?: AuthenticatorPb;
  username?: string;
  password?: string;
  config?: ClusterConfigPb;
}

export class SdkUtils {
  static connectionOptions(
    { authenticator, username, password, config }: ConnectOptionParams = {},
    connection: Connection,
  ): ConnectOptions {
    let opts: ConnectOptions = {};
    if (authenticator) {
      const auth = SdkUtils.getAuthenticator(authenticator);
      opts = {
        authenticator: auth,
      };
    } else if (username && password) {
      opts = {
        username: username,
        password: password,
      };
    }

    if (!config) {
      return opts;
    }

    let trustStorePath: string | undefined = undefined;
    if (config.hasCertPath()) {
      trustStorePath = config.getCertPath() as string;
    } else if (config.hasCert()) {
      trustStorePath = SdkUtils.getCertPath(config.getCert() as string);
    }
    if (typeof trustStorePath === "string") {
      opts["security"] = { trustStorePath: trustStorePath };
    }

    opts.timeouts = {
      kvTimeout: config.getKvTimeoutMillis(),
      kvDurableTimeout: config.getKvDurableTimeoutMillis(),
      viewTimeout: config.getViewTimeoutSecs(),
      queryTimeout: config.getQueryTimeoutSecs(),
      analyticsTimeout: config.getAnalyticsTimeoutSecs(),
      searchTimeout: config.getSearchTimeoutSecs(),
      managementTimeout: config.getManagementTimeoutSecs(),
    };
    opts.transcoder = SdkUtils.toTranscoder(config.getTranscoder());
    // [if:4.5.0]
    if (config.hasPreferredServerGroup()) {
      opts.preferredServerGroup = config.getPreferredServerGroup();
    }
    if (config) {
      opts.appTelemetryConfig = SdkUtils.getAppTelemetryConfig(config);
    }
    // [end]
    // [if:4.7.0]
    if (config.hasObservabilityConfig()) {
      SdkUtils.setupObservabilityConfig(
        connection as unknown as IObservableConnection,
        opts,
        config.getObservabilityConfig() as ObservabilityConfigPb,
      );
    }
    // [end]
    return opts;
  }

  static convertConsistentWith(state: MutationStatePb): MutationState {
    const mutationState = new MutationState();
    for (const token of state.getTokensList()) {
      mutationState.add(
        new MutationTokenImpl(
          token.getBucketName(),
          token.getPartitionId(),
          token.getPartitionUuid().toString(),
          token.getSequenceNumber().toString(),
        ),
      );
    }
    return mutationState;
  }

  // [if:4.5.0]
  static getAppTelemetryConfig(config: ClusterConfigPb): AppTelemetryConfig {
    const appTelemetryConfig: AppTelemetryConfig = {};
    if (config.hasEnableAppTelemetry()) {
      appTelemetryConfig.enabled = config.getEnableAppTelemetry();
    }
    if (config.hasAppTelemetryEndpoint()) {
      appTelemetryConfig.endpoint = config.getAppTelemetryEndpoint();
    }
    if (config.hasAppTelemetryBackoffSecs()) {
      appTelemetryConfig.backoff =
        (config.getAppTelemetryBackoffSecs() as number) * 1000;
    }
    if (config.hasAppTelemetryPingIntervalSecs()) {
      appTelemetryConfig.pingInterval =
        (config.getAppTelemetryPingIntervalSecs() as number) * 1000;
    }
    if (config.hasAppTelemetryPingTimeoutSecs()) {
      appTelemetryConfig.pingTimeout =
        (config.getAppTelemetryPingTimeoutSecs() as number) * 1000;
    }
    return appTelemetryConfig;
  }
  // [end]

  static getCertPath(cert: string, nameOverride?: string): string {
    const tmpDir = mkdtempSync(`${tmpdir()}${sep}`);
    const fileName = nameOverride ? nameOverride : "cert.pem";
    const certPath = join(tmpDir, fileName);
    try {
      writeFileSync(certPath, cert);
    } catch (err) {
      console.error("Error writing certificate to file.", err);
    }
    return certPath;
  }

  static getAuthenticator(auth: AuthenticatorPb): Authenticator {
    switch (auth.getAuthenticatorCase()) {
      case AuthenticatorCase.CERTIFICATE_AUTH: {
        const certAuth = auth.getCertificateAuth();
        if (!certAuth) {
          throw new Error("Missing expected CertificateAuthenticator.");
        }
        const certPath = SdkUtils.getCertPath(certAuth.getCert(), "client.pem");
        const keyPath = SdkUtils.getCertPath(certAuth.getKey(), "private.key");
        return new CertificateAuthenticator(certPath, keyPath);
      }
      case AuthenticatorCase.PASSWORD_AUTH: {
        const passwordAuth = auth.getPasswordAuth();
        if (!passwordAuth) {
          throw new Error("Missing expected PasswordAuthenticator.");
        }
        return new PasswordAuthenticator(
          passwordAuth.getUsername(),
          passwordAuth.getPassword(),
        );
      }
      case AuthenticatorCase.JWT_AUTH: {
        // [if:4.7.0]
        const jwtAuth = auth.getJwtAuth();
        if (!jwtAuth) {
          throw new Error("Missing expected JwtAuthenticator.");
        }
        return new JwtAuthenticator(jwtAuth.getJwt());
        // [end]
      }
      case AuthenticatorCase.AUTHENTICATOR_NOT_SET:
      default:
        throw new NotImplementedError(
          "getAuthenticator() called for a non-implemented Authenticator.",
        );
    }
  }

  static getConnectionString(
    hostname: string,
    requiresTls: boolean,
    config: ClusterConfigPb | undefined,
  ): string {
    if (!config) {
      return hostname;
    }
    let connString = hostname;

    if (!connString.includes("://")) {
      connString = `${
        config.getUseTls() ? "couchbases://" : "couchbase://"
      }${connString}`;
    } else if (requiresTls && connString.startsWith("couchbase://")) {
      // Certificate and JWT auth require TLS and cannot run over a plaintext
      // connection. The FIT config supplies the hostname with a scheme already
      // attached (e.g. couchbase://host), so the block above is skipped --
      // upgrade it here so the TLS handshake can complete.
      connString = connString.replace(/^couchbase:\/\//, "couchbases://");
    } else if (config.getUseTls() && connString.startsWith("couchbase://")) {
      // TLS was requested but the supplied connection string still carries the
      // plaintext couchbase:// scheme. We leave the logic unchanged for now (it
      // happens to work because SASL auth tolerates a plaintext connection),
      // but warn so we can tighten this up later.
      console.warn(
        `TLS is enabled but connection string '${connString}' uses the plaintext couchbase:// scheme; leaving as-is.`,
      );
    }

    const options = [];

    if (config.hasCertPath()) {
      options.push(`trust_certificate=${config.getCertPath()}`);
    } else if (config.hasCert()) {
      const tmpPath = SdkUtils.getCertPath(config.getCert() as string);
      options.push(`trust_certificate=${tmpPath}`);
    }
    if (config.getInsecure()) {
      options.push(`tls_verify=none`);
    }

    if (options.length > 0) {
      connString += `?${options.join("&")}`;
    }
    return connString;
  }

  static getContentTypes(
    contentAs: ContentAsPb | undefined,
    content: any,
  ): ContentTypesPb {
    const types = new ContentTypesPb();
    let encodedContent: any;
    if (!contentAs) {
      // Default to contentAsBytes if unset
      encodedContent = Buffer.isBuffer(content)
        ? content
        : new TextEncoder().encode(JSON.stringify(content));
      types.setContentAsBytes(encodedContent);
      return types;
    }
    switch (contentAs.getAsCase()) {
      case ContentAsCase.AS_BYTE_ARRAY:
      case ContentAsCase.AS_JSON_OBJECT:
      case ContentAsCase.AS_JSON_ARRAY:
        encodedContent = Buffer.isBuffer(content)
          ? content
          : new TextEncoder().encode(JSON.stringify(content));
        types.setContentAsBytes(encodedContent);
        return types;
      case ContentAsCase.AS_STRING:
        types.setContentAsString(
          Buffer.isBuffer(content)
            ? content.toString("utf-8")
            : String(content),
        );
        return types;
      case ContentAsCase.AS_INTEGER:
        encodedContent = parseInt(
          Buffer.isBuffer(content) ? content.toString("utf-8") : content,
        );
        types.setContentAsInt64(encodedContent);
        return types;
      case ContentAsCase.AS_FLOATING_POINT:
        encodedContent = parseFloat(
          Buffer.isBuffer(content) ? content.toString("utf-8") : content,
        );
        types.setContentAsDouble(encodedContent);
        return types;
      case ContentAsCase.AS_BOOLEAN:
        encodedContent = Buffer.isBuffer(content)
          ? content.toString("utf-8") === "true"
          : Boolean(content);
        types.setContentAsBool(encodedContent);
        return types;
      default:
        throw new NotImplementedError("Unimplemented ContentAs type");
    }
  }

  static getCouchbaseVersion(): number[] | undefined {
    const dirTokens = __dirname.split(delimiter);
    // go up 3 dirs
    const nodeModulesPath = dirTokens
      .slice(0, dirTokens.length - 3)
      .join(delimiter);
    const modules = readdirSync(join(nodeModulesPath, "node_modules"));
    let couchbaseVersion: string | undefined;
    modules.forEach((m) => {
      if (m != "couchbase") return;

      const cbPackagePath = join(
        nodeModulesPath,
        "node_modules",
        m,
        "package.json",
      );
      const cbPackageJson = readFileSync(cbPackagePath, "utf-8");
      const cbPackage = JSON.parse(cbPackageJson);
      couchbaseVersion = cbPackage.version;
    });

    if (couchbaseVersion) {
      return couchbaseVersion
        .replace("-dev", "")
        .split(".")
        .map((t) => parseInt(t));
    }
  }

  static getId(location: DocLocationPb, counters: Counters): string {
    switch (location.getLocationCase()) {
      case DocLocationPb.LocationCase.SPECIFIC: {
        const specific = location.getSpecific() as DocLocationSpecificPb;
        return specific.getId();
      }
      case DocLocationPb.LocationCase.UUID: {
        return uuidv4();
      }
      case DocLocationPb.LocationCase.POOL: {
        const pool = location.getPool() as DocLocationPoolPb;
        if (pool.hasRandom()) {
          const randomInt = SdkUtils.getRandomIntAsString(
            0,
            pool.getPoolSize(),
          );
          return pool.getIdPreface() + randomInt;
        } else if (pool.hasCounter()) {
          const counterStrategy =
            pool.getCounter() as PoolSelectionStrategyCounterPb;
          const counter = counters.get(
            counterStrategy.getCounter() as CounterPb,
          );
          const counterResult = String(
            counter.getAndIncrement() % pool.getPoolSize(),
          );
          return pool.getIdPreface() + counterResult;
        }
        break;
      }
      default: {
        throw new Error(
          "Location type is not recognised" + location.getLocationCase(),
        );
      }
    }
    throw new Error("Error getting DocId");
  }

  static getInitiated(): Timestamp {
    const timeMS = Date.now();
    const initiated = new Timestamp();
    initiated.setSeconds(Math.round(timeMS / 1000));
    initiated.setNanos((timeMS % 1000) * 1e6);
    return initiated;
  }

  static getLocationType(location: DocLocationPb): DocLocationsPb {
    switch (location.getLocationCase()) {
      case LocationCase.SPECIFIC:
        return location.getSpecific() as DocLocationSpecificPb;
      case LocationCase.UUID:
        return location.getUuid() as DocLocationUuidPb;
      case LocationCase.POOL:
        return location.getPool() as DocLocationPoolPb;
      default:
        throw new Error("Unknown location type");
    }
  }

  static getRandomIntAsString(min: number, max: number): string {
    return String(Math.floor(Math.random() * (max - min)) + min);
  }

  static isValidCouchbaseVersion(
    major: number,
    minor: number,
    patch?: number,
  ): boolean {
    const cbVersion = SdkUtils.getCouchbaseVersion();
    if (!cbVersion) {
      return false;
    }
    if (cbVersion[0] > major) {
      return true;
    }
    if (cbVersion[0] == major) {
      if (patch) {
        return (
          cbVersion[1] > minor ||
          (cbVersion[1] == minor && cbVersion[2] >= patch)
        );
      } else {
        return cbVersion[1] >= minor;
      }
    }
    // cbVersion[0] < major
    return false;
  }

  static toCollection(cluster: Cluster, collection: CollectionPb): Collection {
    return cluster
      .bucket(collection.getBucketName())
      .scope(collection.getScopeName())
      .collection(collection.getCollectionName());
  }

  static toDurabilityLevel(level: DurabilityPb): DurabilityLevel {
    switch (level) {
      case DurabilityPb.NONE:
        return DurabilityLevel.None;
      case DurabilityPb.MAJORITY:
        return DurabilityLevel.Majority;
      case DurabilityPb.PERSIST_TO_MAJORITY:
        return DurabilityLevel.PersistToMajority;
      case DurabilityPb.MAJORITY_AND_PERSIST_TO_ACTIVE:
        return DurabilityLevel.MajorityAndPersistOnMaster;
      default:
        return DurabilityLevel.None;
    }
  }

  static toDurabilityLevelPb(level: DurabilityLevel): DurabilityPb {
    switch (level) {
      case DurabilityLevel.None:
        return DurabilityPb.NONE;
      case DurabilityLevel.Majority:
        return DurabilityPb.MAJORITY;
      case DurabilityLevel.MajorityAndPersistOnMaster:
        return DurabilityPb.MAJORITY_AND_PERSIST_TO_ACTIVE;
      case DurabilityLevel.PersistToMajority:
        return DurabilityPb.PERSIST_TO_MAJORITY;
      default:
        throw new NotImplementedError(
          "Unknown durability level returned from SDK",
        );
    }
  }
  // [if:4.6.0]
  static toExpiry(expiry: ExpiryPb | undefined): number | Date | undefined {
    // [else]
    //? static toExpiry(expiry: ExpiryPb | undefined): number | undefined {
    // [end]
    if (!expiry) return undefined;
    if (expiry.hasAbsoluteepochsecs()) {
      // [if:4.6.0]
      return new Date(expiry.getAbsoluteepochsecs() * 1000);
      // [else]
      // we need to remove the epoch seconds b/c the SDK will handle accordingly (if needed)
      //? return expiry.getAbsoluteepochsecs() - Math.floor(Date.now() / 1000);
      // [end]
    } else if (expiry.hasRelativesecs()) {
      return expiry.getRelativesecs();
    } else {
      return undefined;
    }
  }

  // [if:4.5.0]
  static toReadPreference(readPreferencePb: ReadPreferencePb): ReadPreference {
    switch (readPreferencePb) {
      case ReadPreferencePb.NO_PREFERENCE:
        return ReadPreference.NoPreference;
      case ReadPreferencePb.SELECTED_SERVER_GROUP:
        return ReadPreference.SelectedServerGroup;
      default:
        return ReadPreference.NoPreference;
    }
  }
  // [end]

  static toTokenPb(token: MutationToken): MutationTokenPb {
    const tokenJSON = token.toJSON();
    const res = new MutationTokenPb();
    res.setBucketName(tokenJSON.bucket_name);
    res.setPartitionId(tokenJSON.partition_id);
    res.setPartitionUuid(parseInt(tokenJSON.partition_uuid));
    res.setSequenceNumber(parseInt(tokenJSON.sequence_number));
    return res;
  }

  static toTranscoder(
    transcoderPb: TranscoderPb | undefined,
  ): Transcoder | undefined {
    if (!transcoderPb) {
      return transcoderPb;
    }

    let transcoder: Transcoder | undefined;
    switch (transcoderPb.getTranscoderCase()) {
      case TranscoderCase.TRANSCODER_NOT_SET:
        transcoder = undefined;
        break;
      case TranscoderCase.JSON:
        transcoder = new DefaultTranscoder();
        break;
      case TranscoderCase.LEGACY:
        throw new NotImplementedError(
          "Legacy transcoder unimplemented in node sdk",
        );
      // [if:4.4.4]
      case TranscoderCase.RAW_JSON:
        transcoder = new RawJsonTranscoder();
        break;
      case TranscoderCase.RAW_STRING:
        transcoder = new RawStringTranscoder();
        break;
      case TranscoderCase.RAW_BINARY:
        transcoder = new RawBinaryTranscoder();
        break;
      // [else]
      //?case TranscoderCase.RAW_JSON:
      //?  // Not throwing to support perf testing with older SDK versions, and the default transcoder works fine for
      //?  // perf testing in Node.
      //?  break;
      //?case TranscoderCase.RAW_STRING:
      //?  throw new NotImplementedError(
      //?    "Raw String Transcoder unimplemented in node sdk versions before 4.4.4",
      //?  );
      //?case TranscoderCase.RAW_BINARY:
      //?  throw new NotImplementedError(
      //?    "Raw Binary Transcoder unimplemented in node sdk versions before 4.4.4",
      //?  );
      // [end]
    }
    return transcoder;
  }

  // [if:4.7.0]
  static setupObservabilityConfig(
    connection: IObservableConnection,
    opts: ConnectOptions,
    config: ObservabilityConfigPb,
  ) {
    if (config.getUseNoopTracer()) {
      opts.tracingConfig = { enableTracing: false };
    } else if (config.hasTracing()) {
      if (config.hasThresholdLoggingTracer()) {
        const thresholdLoggingConfig =
          config.getThresholdLoggingTracer() as ThresholdLoggingTracerConfigPb;
        const tracingConfig: TracingConfig = {};
        if (thresholdLoggingConfig.hasEmitIntervalMillis()) {
          tracingConfig["emitInterval"] =
            thresholdLoggingConfig.getEmitIntervalMillis();
        }
        if (thresholdLoggingConfig.hasSampleSize()) {
          tracingConfig["sampleSize"] = thresholdLoggingConfig.getSampleSize();
        }
        if (thresholdLoggingConfig.hasKvThresholdMillis()) {
          tracingConfig["kvThreshold"] =
            thresholdLoggingConfig.getKvThresholdMillis();
        }
        if (thresholdLoggingConfig.hasQueryThresholdMillis()) {
          tracingConfig["queryThreshold"] =
            thresholdLoggingConfig.getQueryThresholdMillis();
        }
        if (thresholdLoggingConfig.hasSearchThresholdMillis()) {
          tracingConfig["searchThreshold"] =
            thresholdLoggingConfig.getSearchThresholdMillis();
        }
        if (thresholdLoggingConfig.hasAnalyticsThresholdMillis()) {
          tracingConfig["analyticsThreshold"] =
            thresholdLoggingConfig.getAnalyticsThresholdMillis();
        }
        if (thresholdLoggingConfig.hasViewsThresholdMillis()) {
          tracingConfig["viewsThreshold"] =
            thresholdLoggingConfig.getViewsThresholdMillis();
        }
        if (thresholdLoggingConfig.hasEnabled()) {
          tracingConfig["enableTracing"] = thresholdLoggingConfig.getEnabled();
        }
        opts.tracingConfig = tracingConfig;
      } else {
        connection.createTracer(config.getTracing() as TracingConfigPb);
        opts.tracer = connection.tracer;
      }
    } else {
      opts.tracingConfig = { enableTracing: false };
    }

    if (config.hasMetrics()) {
      if (config.hasLoggingMeter()) {
        const logginMeterConfig =
          config.getLoggingMeter() as LoggingMeterConfigPb;
        const metricsConfig: MetricsConfig = {};
        if (logginMeterConfig.hasEmitIntervalMillis()) {
          metricsConfig["emitInterval"] =
            logginMeterConfig.getEmitIntervalMillis();
        }
        if (logginMeterConfig.hasEnabled()) {
          metricsConfig["enableMetrics"] = logginMeterConfig.getEnabled();
        }
        opts.metricsConfig = metricsConfig;
      } else {
        connection.createMeter(config.getMetrics() as MetricsConfigPb);
        opts.meter = connection.meter;
      }
    } else {
      opts.metricsConfig = { enableMetrics: false };
    }
  }
  // [end]
}

class MutationTokenImpl implements MutationToken {
  private bucket_name: string;
  private partition_id: number;
  private partition_uuid: string;
  private sequence_number: string;

  constructor(
    bucketName: string,
    partitionId: number,
    partitionUuid: string,
    sequenceNumber: string,
  ) {
    this.bucket_name = bucketName;
    this.partition_id = partitionId;
    this.partition_uuid = partitionUuid;
    this.sequence_number = sequenceNumber;
  }

  toString(): string {
    return (
      this.bucket_name +
      ":" +
      this.partition_id +
      ":" +
      this.partition_uuid +
      ":" +
      this.sequence_number
    );
  }

  toJSON(): any {
    return {
      bucket_name: this.bucket_name,
      partition_id: this.partition_id,
      partition_uuid: this.partition_uuid,
      sequence_number: this.sequence_number,
    };
  }
}
