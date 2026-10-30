import type * as grpc from '@grpc/grpc-js';
import type { MessageTypeDefinition } from '@grpc/proto-loader';

import type { ViewQueryRequest as _couchbase_view_v1_ViewQueryRequest, ViewQueryRequest__Output as _couchbase_view_v1_ViewQueryRequest__Output } from './couchbase/view/v1/ViewQueryRequest';
import type { ViewQueryResponse as _couchbase_view_v1_ViewQueryResponse, ViewQueryResponse__Output as _couchbase_view_v1_ViewQueryResponse__Output } from './couchbase/view/v1/ViewQueryResponse';
import type { ViewServiceClient as _couchbase_view_v1_ViewServiceClient, ViewServiceDefinition as _couchbase_view_v1_ViewServiceDefinition } from './couchbase/view/v1/ViewService';

type SubtypeConstructor<Constructor extends new (...args: any) => any, Subtype> = {
  new(...args: ConstructorParameters<Constructor>): Subtype;
};

export interface ProtoGrpcType {
  couchbase: {
    view: {
      v1: {
        ViewQueryRequest: MessageTypeDefinition<_couchbase_view_v1_ViewQueryRequest, _couchbase_view_v1_ViewQueryRequest__Output>
        ViewQueryResponse: MessageTypeDefinition<_couchbase_view_v1_ViewQueryResponse, _couchbase_view_v1_ViewQueryResponse__Output>
        /**
         * ViewService provides MapReduce view query execution.
         */
        ViewService: SubtypeConstructor<typeof grpc.Client, _couchbase_view_v1_ViewServiceClient> & { service: _couchbase_view_v1_ViewServiceDefinition }
      }
    }
  }
}

