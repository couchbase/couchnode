// Original file: couchbase/transactions/v1/transactions.proto

import type * as grpc from '@grpc/grpc-js'
import type { MethodDefinition } from '@grpc/proto-loader'
import type { TransactionBeginAttemptRequest as _couchbase_transactions_v1_TransactionBeginAttemptRequest, TransactionBeginAttemptRequest__Output as _couchbase_transactions_v1_TransactionBeginAttemptRequest__Output } from '../../../couchbase/transactions/v1/TransactionBeginAttemptRequest';
import type { TransactionBeginAttemptResponse as _couchbase_transactions_v1_TransactionBeginAttemptResponse, TransactionBeginAttemptResponse__Output as _couchbase_transactions_v1_TransactionBeginAttemptResponse__Output } from '../../../couchbase/transactions/v1/TransactionBeginAttemptResponse';
import type { TransactionCommitRequest as _couchbase_transactions_v1_TransactionCommitRequest, TransactionCommitRequest__Output as _couchbase_transactions_v1_TransactionCommitRequest__Output } from '../../../couchbase/transactions/v1/TransactionCommitRequest';
import type { TransactionCommitResponse as _couchbase_transactions_v1_TransactionCommitResponse, TransactionCommitResponse__Output as _couchbase_transactions_v1_TransactionCommitResponse__Output } from '../../../couchbase/transactions/v1/TransactionCommitResponse';
import type { TransactionGetRequest as _couchbase_transactions_v1_TransactionGetRequest, TransactionGetRequest__Output as _couchbase_transactions_v1_TransactionGetRequest__Output } from '../../../couchbase/transactions/v1/TransactionGetRequest';
import type { TransactionGetResponse as _couchbase_transactions_v1_TransactionGetResponse, TransactionGetResponse__Output as _couchbase_transactions_v1_TransactionGetResponse__Output } from '../../../couchbase/transactions/v1/TransactionGetResponse';
import type { TransactionInsertRequest as _couchbase_transactions_v1_TransactionInsertRequest, TransactionInsertRequest__Output as _couchbase_transactions_v1_TransactionInsertRequest__Output } from '../../../couchbase/transactions/v1/TransactionInsertRequest';
import type { TransactionInsertResponse as _couchbase_transactions_v1_TransactionInsertResponse, TransactionInsertResponse__Output as _couchbase_transactions_v1_TransactionInsertResponse__Output } from '../../../couchbase/transactions/v1/TransactionInsertResponse';
import type { TransactionRemoveRequest as _couchbase_transactions_v1_TransactionRemoveRequest, TransactionRemoveRequest__Output as _couchbase_transactions_v1_TransactionRemoveRequest__Output } from '../../../couchbase/transactions/v1/TransactionRemoveRequest';
import type { TransactionRemoveResponse as _couchbase_transactions_v1_TransactionRemoveResponse, TransactionRemoveResponse__Output as _couchbase_transactions_v1_TransactionRemoveResponse__Output } from '../../../couchbase/transactions/v1/TransactionRemoveResponse';
import type { TransactionReplaceRequest as _couchbase_transactions_v1_TransactionReplaceRequest, TransactionReplaceRequest__Output as _couchbase_transactions_v1_TransactionReplaceRequest__Output } from '../../../couchbase/transactions/v1/TransactionReplaceRequest';
import type { TransactionReplaceResponse as _couchbase_transactions_v1_TransactionReplaceResponse, TransactionReplaceResponse__Output as _couchbase_transactions_v1_TransactionReplaceResponse__Output } from '../../../couchbase/transactions/v1/TransactionReplaceResponse';
import type { TransactionRollbackRequest as _couchbase_transactions_v1_TransactionRollbackRequest, TransactionRollbackRequest__Output as _couchbase_transactions_v1_TransactionRollbackRequest__Output } from '../../../couchbase/transactions/v1/TransactionRollbackRequest';
import type { TransactionRollbackResponse as _couchbase_transactions_v1_TransactionRollbackResponse, TransactionRollbackResponse__Output as _couchbase_transactions_v1_TransactionRollbackResponse__Output } from '../../../couchbase/transactions/v1/TransactionRollbackResponse';

/**
 * TransactionsService provides distributed ACID transactions.
 * All data operations must reference a valid transaction_id and attempt_id
 * obtained from TransactionBeginAttempt.
 */
export interface TransactionsServiceClient extends grpc.Client {
  /**
   * TransactionBeginAttempt starts a new transaction attempt. Returns
   * a transaction_id and attempt_id to use for all subsequent operations.
   * If transaction_id is provided, this begins a retry attempt for an
   * existing transaction.
   */
  TransactionBeginAttempt(argument: _couchbase_transactions_v1_TransactionBeginAttemptRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionBeginAttemptResponse__Output>): grpc.ClientUnaryCall;
  TransactionBeginAttempt(argument: _couchbase_transactions_v1_TransactionBeginAttemptRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionBeginAttemptResponse__Output>): grpc.ClientUnaryCall;
  TransactionBeginAttempt(argument: _couchbase_transactions_v1_TransactionBeginAttemptRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionBeginAttemptResponse__Output>): grpc.ClientUnaryCall;
  TransactionBeginAttempt(argument: _couchbase_transactions_v1_TransactionBeginAttemptRequest, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionBeginAttemptResponse__Output>): grpc.ClientUnaryCall;
  /**
   * TransactionBeginAttempt starts a new transaction attempt. Returns
   * a transaction_id and attempt_id to use for all subsequent operations.
   * If transaction_id is provided, this begins a retry attempt for an
   * existing transaction.
   */
  transactionBeginAttempt(argument: _couchbase_transactions_v1_TransactionBeginAttemptRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionBeginAttemptResponse__Output>): grpc.ClientUnaryCall;
  transactionBeginAttempt(argument: _couchbase_transactions_v1_TransactionBeginAttemptRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionBeginAttemptResponse__Output>): grpc.ClientUnaryCall;
  transactionBeginAttempt(argument: _couchbase_transactions_v1_TransactionBeginAttemptRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionBeginAttemptResponse__Output>): grpc.ClientUnaryCall;
  transactionBeginAttempt(argument: _couchbase_transactions_v1_TransactionBeginAttemptRequest, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionBeginAttemptResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * TransactionCommit commits all mutations made within the transaction
   * attempt, making them visible to other operations.
   */
  TransactionCommit(argument: _couchbase_transactions_v1_TransactionCommitRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionCommitResponse__Output>): grpc.ClientUnaryCall;
  TransactionCommit(argument: _couchbase_transactions_v1_TransactionCommitRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionCommitResponse__Output>): grpc.ClientUnaryCall;
  TransactionCommit(argument: _couchbase_transactions_v1_TransactionCommitRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionCommitResponse__Output>): grpc.ClientUnaryCall;
  TransactionCommit(argument: _couchbase_transactions_v1_TransactionCommitRequest, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionCommitResponse__Output>): grpc.ClientUnaryCall;
  /**
   * TransactionCommit commits all mutations made within the transaction
   * attempt, making them visible to other operations.
   */
  transactionCommit(argument: _couchbase_transactions_v1_TransactionCommitRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionCommitResponse__Output>): grpc.ClientUnaryCall;
  transactionCommit(argument: _couchbase_transactions_v1_TransactionCommitRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionCommitResponse__Output>): grpc.ClientUnaryCall;
  transactionCommit(argument: _couchbase_transactions_v1_TransactionCommitRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionCommitResponse__Output>): grpc.ClientUnaryCall;
  transactionCommit(argument: _couchbase_transactions_v1_TransactionCommitRequest, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionCommitResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * TransactionGet retrieves a document within the transaction context.
   * The returned CAS must be used for subsequent Replace or Remove
   * operations on this document within the same transaction.
   */
  TransactionGet(argument: _couchbase_transactions_v1_TransactionGetRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionGetResponse__Output>): grpc.ClientUnaryCall;
  TransactionGet(argument: _couchbase_transactions_v1_TransactionGetRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionGetResponse__Output>): grpc.ClientUnaryCall;
  TransactionGet(argument: _couchbase_transactions_v1_TransactionGetRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionGetResponse__Output>): grpc.ClientUnaryCall;
  TransactionGet(argument: _couchbase_transactions_v1_TransactionGetRequest, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionGetResponse__Output>): grpc.ClientUnaryCall;
  /**
   * TransactionGet retrieves a document within the transaction context.
   * The returned CAS must be used for subsequent Replace or Remove
   * operations on this document within the same transaction.
   */
  transactionGet(argument: _couchbase_transactions_v1_TransactionGetRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionGetResponse__Output>): grpc.ClientUnaryCall;
  transactionGet(argument: _couchbase_transactions_v1_TransactionGetRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionGetResponse__Output>): grpc.ClientUnaryCall;
  transactionGet(argument: _couchbase_transactions_v1_TransactionGetRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionGetResponse__Output>): grpc.ClientUnaryCall;
  transactionGet(argument: _couchbase_transactions_v1_TransactionGetRequest, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionGetResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * TransactionInsert creates a new document within the transaction.
   * Fails if the document already exists.
   */
  TransactionInsert(argument: _couchbase_transactions_v1_TransactionInsertRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionInsertResponse__Output>): grpc.ClientUnaryCall;
  TransactionInsert(argument: _couchbase_transactions_v1_TransactionInsertRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionInsertResponse__Output>): grpc.ClientUnaryCall;
  TransactionInsert(argument: _couchbase_transactions_v1_TransactionInsertRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionInsertResponse__Output>): grpc.ClientUnaryCall;
  TransactionInsert(argument: _couchbase_transactions_v1_TransactionInsertRequest, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionInsertResponse__Output>): grpc.ClientUnaryCall;
  /**
   * TransactionInsert creates a new document within the transaction.
   * Fails if the document already exists.
   */
  transactionInsert(argument: _couchbase_transactions_v1_TransactionInsertRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionInsertResponse__Output>): grpc.ClientUnaryCall;
  transactionInsert(argument: _couchbase_transactions_v1_TransactionInsertRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionInsertResponse__Output>): grpc.ClientUnaryCall;
  transactionInsert(argument: _couchbase_transactions_v1_TransactionInsertRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionInsertResponse__Output>): grpc.ClientUnaryCall;
  transactionInsert(argument: _couchbase_transactions_v1_TransactionInsertRequest, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionInsertResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * TransactionRemove removes a document within the transaction.
   * Requires the CAS from a prior TransactionGet.
   */
  TransactionRemove(argument: _couchbase_transactions_v1_TransactionRemoveRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionRemoveResponse__Output>): grpc.ClientUnaryCall;
  TransactionRemove(argument: _couchbase_transactions_v1_TransactionRemoveRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionRemoveResponse__Output>): grpc.ClientUnaryCall;
  TransactionRemove(argument: _couchbase_transactions_v1_TransactionRemoveRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionRemoveResponse__Output>): grpc.ClientUnaryCall;
  TransactionRemove(argument: _couchbase_transactions_v1_TransactionRemoveRequest, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionRemoveResponse__Output>): grpc.ClientUnaryCall;
  /**
   * TransactionRemove removes a document within the transaction.
   * Requires the CAS from a prior TransactionGet.
   */
  transactionRemove(argument: _couchbase_transactions_v1_TransactionRemoveRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionRemoveResponse__Output>): grpc.ClientUnaryCall;
  transactionRemove(argument: _couchbase_transactions_v1_TransactionRemoveRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionRemoveResponse__Output>): grpc.ClientUnaryCall;
  transactionRemove(argument: _couchbase_transactions_v1_TransactionRemoveRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionRemoveResponse__Output>): grpc.ClientUnaryCall;
  transactionRemove(argument: _couchbase_transactions_v1_TransactionRemoveRequest, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionRemoveResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * TransactionReplace replaces an existing document within the transaction.
   * Requires the CAS from a prior TransactionGet.
   */
  TransactionReplace(argument: _couchbase_transactions_v1_TransactionReplaceRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionReplaceResponse__Output>): grpc.ClientUnaryCall;
  TransactionReplace(argument: _couchbase_transactions_v1_TransactionReplaceRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionReplaceResponse__Output>): grpc.ClientUnaryCall;
  TransactionReplace(argument: _couchbase_transactions_v1_TransactionReplaceRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionReplaceResponse__Output>): grpc.ClientUnaryCall;
  TransactionReplace(argument: _couchbase_transactions_v1_TransactionReplaceRequest, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionReplaceResponse__Output>): grpc.ClientUnaryCall;
  /**
   * TransactionReplace replaces an existing document within the transaction.
   * Requires the CAS from a prior TransactionGet.
   */
  transactionReplace(argument: _couchbase_transactions_v1_TransactionReplaceRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionReplaceResponse__Output>): grpc.ClientUnaryCall;
  transactionReplace(argument: _couchbase_transactions_v1_TransactionReplaceRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionReplaceResponse__Output>): grpc.ClientUnaryCall;
  transactionReplace(argument: _couchbase_transactions_v1_TransactionReplaceRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionReplaceResponse__Output>): grpc.ClientUnaryCall;
  transactionReplace(argument: _couchbase_transactions_v1_TransactionReplaceRequest, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionReplaceResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * TransactionRollback aborts the transaction attempt and discards
   * all uncommitted mutations.
   */
  TransactionRollback(argument: _couchbase_transactions_v1_TransactionRollbackRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionRollbackResponse__Output>): grpc.ClientUnaryCall;
  TransactionRollback(argument: _couchbase_transactions_v1_TransactionRollbackRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionRollbackResponse__Output>): grpc.ClientUnaryCall;
  TransactionRollback(argument: _couchbase_transactions_v1_TransactionRollbackRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionRollbackResponse__Output>): grpc.ClientUnaryCall;
  TransactionRollback(argument: _couchbase_transactions_v1_TransactionRollbackRequest, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionRollbackResponse__Output>): grpc.ClientUnaryCall;
  /**
   * TransactionRollback aborts the transaction attempt and discards
   * all uncommitted mutations.
   */
  transactionRollback(argument: _couchbase_transactions_v1_TransactionRollbackRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionRollbackResponse__Output>): grpc.ClientUnaryCall;
  transactionRollback(argument: _couchbase_transactions_v1_TransactionRollbackRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionRollbackResponse__Output>): grpc.ClientUnaryCall;
  transactionRollback(argument: _couchbase_transactions_v1_TransactionRollbackRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionRollbackResponse__Output>): grpc.ClientUnaryCall;
  transactionRollback(argument: _couchbase_transactions_v1_TransactionRollbackRequest, callback: grpc.requestCallback<_couchbase_transactions_v1_TransactionRollbackResponse__Output>): grpc.ClientUnaryCall;
  
}

/**
 * TransactionsService provides distributed ACID transactions.
 * All data operations must reference a valid transaction_id and attempt_id
 * obtained from TransactionBeginAttempt.
 */
export interface TransactionsServiceHandlers extends grpc.UntypedServiceImplementation {
  /**
   * TransactionBeginAttempt starts a new transaction attempt. Returns
   * a transaction_id and attempt_id to use for all subsequent operations.
   * If transaction_id is provided, this begins a retry attempt for an
   * existing transaction.
   */
  TransactionBeginAttempt: grpc.handleUnaryCall<_couchbase_transactions_v1_TransactionBeginAttemptRequest__Output, _couchbase_transactions_v1_TransactionBeginAttemptResponse>;
  
  /**
   * TransactionCommit commits all mutations made within the transaction
   * attempt, making them visible to other operations.
   */
  TransactionCommit: grpc.handleUnaryCall<_couchbase_transactions_v1_TransactionCommitRequest__Output, _couchbase_transactions_v1_TransactionCommitResponse>;
  
  /**
   * TransactionGet retrieves a document within the transaction context.
   * The returned CAS must be used for subsequent Replace or Remove
   * operations on this document within the same transaction.
   */
  TransactionGet: grpc.handleUnaryCall<_couchbase_transactions_v1_TransactionGetRequest__Output, _couchbase_transactions_v1_TransactionGetResponse>;
  
  /**
   * TransactionInsert creates a new document within the transaction.
   * Fails if the document already exists.
   */
  TransactionInsert: grpc.handleUnaryCall<_couchbase_transactions_v1_TransactionInsertRequest__Output, _couchbase_transactions_v1_TransactionInsertResponse>;
  
  /**
   * TransactionRemove removes a document within the transaction.
   * Requires the CAS from a prior TransactionGet.
   */
  TransactionRemove: grpc.handleUnaryCall<_couchbase_transactions_v1_TransactionRemoveRequest__Output, _couchbase_transactions_v1_TransactionRemoveResponse>;
  
  /**
   * TransactionReplace replaces an existing document within the transaction.
   * Requires the CAS from a prior TransactionGet.
   */
  TransactionReplace: grpc.handleUnaryCall<_couchbase_transactions_v1_TransactionReplaceRequest__Output, _couchbase_transactions_v1_TransactionReplaceResponse>;
  
  /**
   * TransactionRollback aborts the transaction attempt and discards
   * all uncommitted mutations.
   */
  TransactionRollback: grpc.handleUnaryCall<_couchbase_transactions_v1_TransactionRollbackRequest__Output, _couchbase_transactions_v1_TransactionRollbackResponse>;
  
}

export interface TransactionsServiceDefinition extends grpc.ServiceDefinition {
  TransactionBeginAttempt: MethodDefinition<_couchbase_transactions_v1_TransactionBeginAttemptRequest, _couchbase_transactions_v1_TransactionBeginAttemptResponse, _couchbase_transactions_v1_TransactionBeginAttemptRequest__Output, _couchbase_transactions_v1_TransactionBeginAttemptResponse__Output>
  TransactionCommit: MethodDefinition<_couchbase_transactions_v1_TransactionCommitRequest, _couchbase_transactions_v1_TransactionCommitResponse, _couchbase_transactions_v1_TransactionCommitRequest__Output, _couchbase_transactions_v1_TransactionCommitResponse__Output>
  TransactionGet: MethodDefinition<_couchbase_transactions_v1_TransactionGetRequest, _couchbase_transactions_v1_TransactionGetResponse, _couchbase_transactions_v1_TransactionGetRequest__Output, _couchbase_transactions_v1_TransactionGetResponse__Output>
  TransactionInsert: MethodDefinition<_couchbase_transactions_v1_TransactionInsertRequest, _couchbase_transactions_v1_TransactionInsertResponse, _couchbase_transactions_v1_TransactionInsertRequest__Output, _couchbase_transactions_v1_TransactionInsertResponse__Output>
  TransactionRemove: MethodDefinition<_couchbase_transactions_v1_TransactionRemoveRequest, _couchbase_transactions_v1_TransactionRemoveResponse, _couchbase_transactions_v1_TransactionRemoveRequest__Output, _couchbase_transactions_v1_TransactionRemoveResponse__Output>
  TransactionReplace: MethodDefinition<_couchbase_transactions_v1_TransactionReplaceRequest, _couchbase_transactions_v1_TransactionReplaceResponse, _couchbase_transactions_v1_TransactionReplaceRequest__Output, _couchbase_transactions_v1_TransactionReplaceResponse__Output>
  TransactionRollback: MethodDefinition<_couchbase_transactions_v1_TransactionRollbackRequest, _couchbase_transactions_v1_TransactionRollbackResponse, _couchbase_transactions_v1_TransactionRollbackRequest__Output, _couchbase_transactions_v1_TransactionRollbackResponse__Output>
}
