// Original file: google/rpc/error_details.proto

import type { Long } from '@grpc/proto-loader';

/**
 * A message type used to describe a single quota violation.  For example, a
 * daily quota or a custom quota that was exceeded.
 */
export interface _google_rpc_QuotaFailure_Violation {
  /**
   * The subject on which the quota check failed.
   * For example, "clientip:<ip address of client>" or "project:<Google
   * developer project id>".
   */
  'subject'?: (string);
  /**
   * A description of how the quota check failed. Clients can use this
   * description to find more about the quota configuration in the service's
   * public documentation, or find the relevant quota limit to adjust through
   * developer console.
   * 
   * For example: "Service disabled" or "Daily Limit for read operations
   * exceeded".
   */
  'description'?: (string);
  /**
   * The API Service from which the `QuotaFailure.Violation` orginates. In
   * some cases, Quota issues originate from an API Service other than the one
   * that was called. In other words, a dependency of the called API Service
   * could be the cause of the `QuotaFailure`, and this field would have the
   * dependency API service name.
   * 
   * For example, if the called API is Kubernetes Engine API
   * (container.googleapis.com), and a quota violation occurs in the
   * Kubernetes Engine API itself, this field would be
   * "container.googleapis.com". On the other hand, if the quota violation
   * occurs when the Kubernetes Engine API creates VMs in the Compute Engine
   * API (compute.googleapis.com), this field would be
   * "compute.googleapis.com".
   */
  'api_service'?: (string);
  /**
   * The metric of the violated quota. A quota metric is a named counter to
   * measure usage, such as API requests or CPUs. When an activity occurs in a
   * service, such as Virtual Machine allocation, one or more quota metrics
   * may be affected.
   * 
   * For example, "compute.googleapis.com/cpus_per_vm_family",
   * "storage.googleapis.com/internet_egress_bandwidth".
   */
  'quota_metric'?: (string);
  /**
   * The id of the violated quota. Also know as "limit name", this is the
   * unique identifier of a quota in the context of an API service.
   * 
   * For example, "CPUS-PER-VM-FAMILY-per-project-region".
   */
  'quota_id'?: (string);
  /**
   * The dimensions of the violated quota. Every non-global quota is enforced
   * on a set of dimensions. While quota metric defines what to count, the
   * dimensions specify for what aspects the counter should be increased.
   * 
   * For example, the quota "CPUs per region per VM family" enforces a limit
   * on the metric "compute.googleapis.com/cpus_per_vm_family" on dimensions
   * "region" and "vm_family". And if the violation occurred in region
   * "us-central1" and for VM family "n1", the quota_dimensions would be,
   * 
   * {
   * "region": "us-central1",
   * "vm_family": "n1",
   * }
   * 
   * When a quota is enforced globally, the quota_dimensions would always be
   * empty.
   */
  'quota_dimensions'?: ({[key: string]: string});
  /**
   * The enforced quota value at the time of the `QuotaFailure`.
   * 
   * For example, if the enforced quota value at the time of the
   * `QuotaFailure` on the number of CPUs is "10", then the value of this
   * field would reflect this quantity.
   */
  'quota_value'?: (number | string | Long);
  /**
   * The new quota value being rolled out at the time of the violation. At the
   * completion of the rollout, this value will be enforced in place of
   * quota_value. If no rollout is in progress at the time of the violation,
   * this field is not set.
   * 
   * For example, if at the time of the violation a rollout is in progress
   * changing the number of CPUs quota from 10 to 20, 20 would be the value of
   * this field.
   */
  'future_quota_value'?: (number | string | Long);
  '_future_quota_value'?: "future_quota_value";
}

/**
 * A message type used to describe a single quota violation.  For example, a
 * daily quota or a custom quota that was exceeded.
 */
export interface _google_rpc_QuotaFailure_Violation__Output {
  /**
   * The subject on which the quota check failed.
   * For example, "clientip:<ip address of client>" or "project:<Google
   * developer project id>".
   */
  'subject': (string);
  /**
   * A description of how the quota check failed. Clients can use this
   * description to find more about the quota configuration in the service's
   * public documentation, or find the relevant quota limit to adjust through
   * developer console.
   * 
   * For example: "Service disabled" or "Daily Limit for read operations
   * exceeded".
   */
  'description': (string);
  /**
   * The API Service from which the `QuotaFailure.Violation` orginates. In
   * some cases, Quota issues originate from an API Service other than the one
   * that was called. In other words, a dependency of the called API Service
   * could be the cause of the `QuotaFailure`, and this field would have the
   * dependency API service name.
   * 
   * For example, if the called API is Kubernetes Engine API
   * (container.googleapis.com), and a quota violation occurs in the
   * Kubernetes Engine API itself, this field would be
   * "container.googleapis.com". On the other hand, if the quota violation
   * occurs when the Kubernetes Engine API creates VMs in the Compute Engine
   * API (compute.googleapis.com), this field would be
   * "compute.googleapis.com".
   */
  'api_service': (string);
  /**
   * The metric of the violated quota. A quota metric is a named counter to
   * measure usage, such as API requests or CPUs. When an activity occurs in a
   * service, such as Virtual Machine allocation, one or more quota metrics
   * may be affected.
   * 
   * For example, "compute.googleapis.com/cpus_per_vm_family",
   * "storage.googleapis.com/internet_egress_bandwidth".
   */
  'quota_metric': (string);
  /**
   * The id of the violated quota. Also know as "limit name", this is the
   * unique identifier of a quota in the context of an API service.
   * 
   * For example, "CPUS-PER-VM-FAMILY-per-project-region".
   */
  'quota_id': (string);
  /**
   * The dimensions of the violated quota. Every non-global quota is enforced
   * on a set of dimensions. While quota metric defines what to count, the
   * dimensions specify for what aspects the counter should be increased.
   * 
   * For example, the quota "CPUs per region per VM family" enforces a limit
   * on the metric "compute.googleapis.com/cpus_per_vm_family" on dimensions
   * "region" and "vm_family". And if the violation occurred in region
   * "us-central1" and for VM family "n1", the quota_dimensions would be,
   * 
   * {
   * "region": "us-central1",
   * "vm_family": "n1",
   * }
   * 
   * When a quota is enforced globally, the quota_dimensions would always be
   * empty.
   */
  'quota_dimensions': ({[key: string]: string});
  /**
   * The enforced quota value at the time of the `QuotaFailure`.
   * 
   * For example, if the enforced quota value at the time of the
   * `QuotaFailure` on the number of CPUs is "10", then the value of this
   * field would reflect this quantity.
   */
  'quota_value': (string);
  /**
   * The new quota value being rolled out at the time of the violation. At the
   * completion of the rollout, this value will be enforced in place of
   * quota_value. If no rollout is in progress at the time of the violation,
   * this field is not set.
   * 
   * For example, if at the time of the violation a rollout is in progress
   * changing the number of CPUs quota from 10 to 20, 20 would be the value of
   * this field.
   */
  'future_quota_value'?: (string);
  '_future_quota_value'?: "future_quota_value";
}

/**
 * Describes how a quota check failed.
 * 
 * For example if a daily limit was exceeded for the calling project,
 * a service could respond with a QuotaFailure detail containing the project
 * id and the description of the quota limit that was exceeded.  If the
 * calling project hasn't enabled the service in the developer console, then
 * a service could respond with the project id and set `service_disabled`
 * to true.
 * 
 * Also see RetryInfo and Help types for other details about handling a
 * quota failure.
 */
export interface QuotaFailure {
  /**
   * Describes all quota violations.
   */
  'violations'?: (_google_rpc_QuotaFailure_Violation)[];
}

/**
 * Describes how a quota check failed.
 * 
 * For example if a daily limit was exceeded for the calling project,
 * a service could respond with a QuotaFailure detail containing the project
 * id and the description of the quota limit that was exceeded.  If the
 * calling project hasn't enabled the service in the developer console, then
 * a service could respond with the project id and set `service_disabled`
 * to true.
 * 
 * Also see RetryInfo and Help types for other details about handling a
 * quota failure.
 */
export interface QuotaFailure__Output {
  /**
   * Describes all quota violations.
   */
  'violations': (_google_rpc_QuotaFailure_Violation__Output)[];
}
