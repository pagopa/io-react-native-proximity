import { z } from 'zod';

// Inner data: a record of booleans with the attributes and the intent to retain flag
const booleanFieldGroup = z.record(z.boolean());

const credentialEntrySchema = z
  .object({
    isAuthenticated: z.boolean(),
  })
  .catchall(booleanFieldGroup);

const VerifierRequest = z.object({
  request: z.record(credentialEntrySchema),
});

/**
 * VerifierRequest type returned by the `onDocumentRequestReceived` event in `Events`.
 * The outermost key represents the credential doctype, the inner key represents the namespace and the innermost key represents the requested fields with a boolean value
 * indicating whether the verifier app wants to retain the field or not. The isAuthenticated field is present for each requested credentials and indicates wether or not the verifier is authenticated.
 * Example:
 *  `{
 *    "org.iso.18013.5.1.mDL": {
 *      "isAuthenticated": true,
 *      "org.iso.18013.5.1": {
 *        "hair_colour": true,
 *        "given_name_national_character": true,
 *        "family_name_national_character": true,
 *        "given_name": true,
 *      }
 *    }
 *  }`
 * The request type can be also be used as input for the `generateResponse` method. The structure is the same, however the boolean value for each claim
 * indicates the willing to present the claim.
 */
export type VerifierRequest = z.infer<typeof VerifierRequest>;

/**
 * Parses the input to a VerifierRequest object.
 * This function is used to parse the request received from the verifier app.
 * @param input - The input to be parsed
 * @returns The parsed VerifierRequest object
 */
export const parseVerifierRequest = (input: unknown): VerifierRequest => {
  return VerifierRequest.parse(input);
};

/**
 * Zod schema for the type returned by the `onError` event in Proximity `Events`.
 */
const Error = z.string().catch('Unknown error');

/**
 * Error type returned by the `onError` event in Proximity `Events`.
 */
export type Error = z.infer<typeof Error>;

/**
 * Parses the input to an Error object.
 * This function is used to parse the error received from the verifier app via the `onError` event.
 * @param input - The input to be parsed
 * @returns The parsed Error object or a default error message if parsing fails
 */
export const parseError = (input: unknown): Error => {
  return Error.parse(input);
};

/**
 * This is the type definition for the accepted fields that will be presented to the verifier app.
 * It contains of a nested object structure, where the outermost key represents the credential doctype.
 * The inner dictionary contains namespaces, and for each namespace, there is another dictionary mapping requested claims to a boolean value,
 * which indicates whether the user is willing to present the corresponding claim. Example:
 * `{
 *    "org.iso.18013.5.1.mDL": {
 *      "org.iso.18013.5.1": {
 *        "hair_colour": true, // Indicates the user is willing to present this claim
 *        "given_name_national_character": true,
 *        "family_name_national_character": true,
 *        "given_name": true,
 *     }
 *    }
 *  }`
 **/
export type AcceptedFields = {
  [credential: string]: {
    [namespace: string]: { [field: string]: boolean };
  };
};
