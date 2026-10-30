// Original file: google/rpc/error_details.proto


/**
 * Describes the resource that is being accessed.
 */
export interface ResourceInfo {
  /**
   * A name for the type of resource being accessed, e.g. "sql table",
   * "cloud storage bucket", "file", "Google calendar"; or the type URL
   * of the resource: e.g. "type.googleapis.com/google.pubsub.v1.Topic".
   */
  'resource_type'?: (string);
  /**
   * The name of the resource being accessed.  For example, a shared calendar
   * name: "example.com_4fghdhgsrgh@group.calendar.google.com", if the current
   * error is
   * [google.rpc.Code.PERMISSION_DENIED][google.rpc.Code.PERMISSION_DENIED].
   */
  'resource_name'?: (string);
  /**
   * The owner of the resource (optional).
   * For example, "user:<owner email>" or "project:<Google developer project
   * id>".
   */
  'owner'?: (string);
  /**
   * Describes what error is encountered when accessing this resource.
   * For example, updating a cloud project may require the `writer` permission
   * on the developer console project.
   */
  'description'?: (string);
}

/**
 * Describes the resource that is being accessed.
 */
export interface ResourceInfo__Output {
  /**
   * A name for the type of resource being accessed, e.g. "sql table",
   * "cloud storage bucket", "file", "Google calendar"; or the type URL
   * of the resource: e.g. "type.googleapis.com/google.pubsub.v1.Topic".
   */
  'resource_type': (string);
  /**
   * The name of the resource being accessed.  For example, a shared calendar
   * name: "example.com_4fghdhgsrgh@group.calendar.google.com", if the current
   * error is
   * [google.rpc.Code.PERMISSION_DENIED][google.rpc.Code.PERMISSION_DENIED].
   */
  'resource_name': (string);
  /**
   * The owner of the resource (optional).
   * For example, "user:<owner email>" or "project:<Google developer project
   * id>".
   */
  'owner': (string);
  /**
   * Describes what error is encountered when accessing this resource.
   * For example, updating a cloud project may require the `writer` permission
   * on the developer console project.
   */
  'description': (string);
}
