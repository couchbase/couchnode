import type * as grpc from '@grpc/grpc-js';
import type { MessageTypeDefinition } from '@grpc/proto-loader';

import type { TransactionBeginAttemptRequest as _couchbase_transactions_v1_TransactionBeginAttemptRequest, TransactionBeginAttemptRequest__Output as _couchbase_transactions_v1_TransactionBeginAttemptRequest__Output } from './couchbase/transactions/v1/TransactionBeginAttemptRequest';
import type { TransactionBeginAttemptResponse as _couchbase_transactions_v1_TransactionBeginAttemptResponse, TransactionBeginAttemptResponse__Output as _couchbase_transactions_v1_TransactionBeginAttemptResponse__Output } from './couchbase/transactions/v1/TransactionBeginAttemptResponse';
import type { TransactionCommitRequest as _couchbase_transactions_v1_TransactionCommitRequest, TransactionCommitRequest__Output as _couchbase_transactions_v1_TransactionCommitRequest__Output } from './couchbase/transactions/v1/TransactionCommitRequest';
import type { TransactionCommitResponse as _couchbase_transactions_v1_TransactionCommitResponse, TransactionCommitResponse__Output as _couchbase_transactions_v1_TransactionCommitResponse__Output } from './couchbase/transactions/v1/TransactionCommitResponse';
import type { TransactionGetRequest as _couchbase_transactions_v1_TransactionGetRequest, TransactionGetRequest__Output as _couchbase_transactions_v1_TransactionGetRequest__Output } from './couchbase/transactions/v1/TransactionGetRequest';
import type { TransactionGetResponse as _couchbase_transactions_v1_TransactionGetResponse, TransactionGetResponse__Output as _couchbase_transactions_v1_TransactionGetResponse__Output } from './couchbase/transactions/v1/TransactionGetResponse';
import type { TransactionInsertRequest as _couchbase_transactions_v1_TransactionInsertRequest, TransactionInsertRequest__Output as _couchbase_transactions_v1_TransactionInsertRequest__Output } from './couchbase/transactions/v1/TransactionInsertRequest';
import type { TransactionInsertResponse as _couchbase_transactions_v1_TransactionInsertResponse, TransactionInsertResponse__Output as _couchbase_transactions_v1_TransactionInsertResponse__Output } from './couchbase/transactions/v1/TransactionInsertResponse';
import type { TransactionRemoveRequest as _couchbase_transactions_v1_TransactionRemoveRequest, TransactionRemoveRequest__Output as _couchbase_transactions_v1_TransactionRemoveRequest__Output } from './couchbase/transactions/v1/TransactionRemoveRequest';
import type { TransactionRemoveResponse as _couchbase_transactions_v1_TransactionRemoveResponse, TransactionRemoveResponse__Output as _couchbase_transactions_v1_TransactionRemoveResponse__Output } from './couchbase/transactions/v1/TransactionRemoveResponse';
import type { TransactionReplaceRequest as _couchbase_transactions_v1_TransactionReplaceRequest, TransactionReplaceRequest__Output as _couchbase_transactions_v1_TransactionReplaceRequest__Output } from './couchbase/transactions/v1/TransactionReplaceRequest';
import type { TransactionReplaceResponse as _couchbase_transactions_v1_TransactionReplaceResponse, TransactionReplaceResponse__Output as _couchbase_transactions_v1_TransactionReplaceResponse__Output } from './couchbase/transactions/v1/TransactionReplaceResponse';
import type { TransactionRollbackRequest as _couchbase_transactions_v1_TransactionRollbackRequest, TransactionRollbackRequest__Output as _couchbase_transactions_v1_TransactionRollbackRequest__Output } from './couchbase/transactions/v1/TransactionRollbackRequest';
import type { TransactionRollbackResponse as _couchbase_transactions_v1_TransactionRollbackResponse, TransactionRollbackResponse__Output as _couchbase_transactions_v1_TransactionRollbackResponse__Output } from './couchbase/transactions/v1/TransactionRollbackResponse';
import type { TransactionsServiceClient as _couchbase_transactions_v1_TransactionsServiceClient, TransactionsServiceDefinition as _couchbase_transactions_v1_TransactionsServiceDefinition } from './couchbase/transactions/v1/TransactionsService';

type SubtypeConstructor<Constructor extends new (...args: any) => any, Subtype> = {
  new(...args: ConstructorParameters<Constructor>): Subtype;
};

export interface ProtoGrpcType {
  couchbase: {
    transactions: {
      v1: {
        TransactionBeginAttemptRequest: MessageTypeDefinition<_couchbase_transactions_v1_TransactionBeginAttemptRequest, _couchbase_transactions_v1_TransactionBeginAttemptRequest__Output>
        TransactionBeginAttemptResponse: MessageTypeDefinition<_couchbase_transactions_v1_TransactionBeginAttemptResponse, _couchbase_transactions_v1_TransactionBeginAttemptResponse__Output>
        TransactionCommitRequest: MessageTypeDefinition<_couchbase_transactions_v1_TransactionCommitRequest, _couchbase_transactions_v1_TransactionCommitRequest__Output>
        TransactionCommitResponse: MessageTypeDefinition<_couchbase_transactions_v1_TransactionCommitResponse, _couchbase_transactions_v1_TransactionCommitResponse__Output>
        TransactionGetRequest: MessageTypeDefinition<_couchbase_transactions_v1_TransactionGetRequest, _couchbase_transactions_v1_TransactionGetRequest__Output>
        TransactionGetResponse: MessageTypeDefinition<_couchbase_transactions_v1_TransactionGetResponse, _couchbase_transactions_v1_TransactionGetResponse__Output>
        TransactionInsertRequest: MessageTypeDefinition<_couchbase_transactions_v1_TransactionInsertRequest, _couchbase_transactions_v1_TransactionInsertRequest__Output>
        TransactionInsertResponse: MessageTypeDefinition<_couchbase_transactions_v1_TransactionInsertResponse, _couchbase_transactions_v1_TransactionInsertResponse__Output>
        TransactionRemoveRequest: MessageTypeDefinition<_couchbase_transactions_v1_TransactionRemoveRequest, _couchbase_transactions_v1_TransactionRemoveRequest__Output>
        TransactionRemoveResponse: MessageTypeDefinition<_couchbase_transactions_v1_TransactionRemoveResponse, _couchbase_transactions_v1_TransactionRemoveResponse__Output>
        TransactionReplaceRequest: MessageTypeDefinition<_couchbase_transactions_v1_TransactionReplaceRequest, _couchbase_transactions_v1_TransactionReplaceRequest__Output>
        TransactionReplaceResponse: MessageTypeDefinition<_couchbase_transactions_v1_TransactionReplaceResponse, _couchbase_transactions_v1_TransactionReplaceResponse__Output>
        TransactionRollbackRequest: MessageTypeDefinition<_couchbase_transactions_v1_TransactionRollbackRequest, _couchbase_transactions_v1_TransactionRollbackRequest__Output>
        TransactionRollbackResponse: MessageTypeDefinition<_couchbase_transactions_v1_TransactionRollbackResponse, _couchbase_transactions_v1_TransactionRollbackResponse__Output>
        /**
         * TransactionsService provides distributed ACID transactions.
         * All data operations must reference a valid transaction_id and attempt_id
         * obtained from TransactionBeginAttempt.
         */
        TransactionsService: SubtypeConstructor<typeof grpc.Client, _couchbase_transactions_v1_TransactionsServiceClient> & { service: _couchbase_transactions_v1_TransactionsServiceDefinition }
      }
    }
  }
}

