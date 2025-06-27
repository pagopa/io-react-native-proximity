/**
 * All error codes that the module could return.
 */
export type OID4VPFailureCodes =
  | 'UNABLE_TO_GENERATE_RESPONSE'
  | 'DOC_REQUESTED_PARSING_EXCEPTION'
  | 'REQUESTED_ITEMS_PARSING_EXCEPTION'
  | 'UNABLE_TO_GENERATE_TRANSCRIPT'
  | 'UNKNOWN_EXCEPTION';

/**
 * Error type returned by a rejected promise.
 *
 * If additional error information are available,
 * they are stored in the {@link OID4VPFailure["userInfo"]} field.
 */
export type OID4VPFailure = {
  message: OID4VPFailureCodes;
  userInfo: Record<string, string>;
};
