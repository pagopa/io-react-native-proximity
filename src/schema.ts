import { z } from 'zod';

const VerifierRequest = z.object({
  isAuthenticated: z.boolean(),
  request: z.record(z.string(), z.record(z.string(),z.record(z.string(), z.boolean()))),
});

/**
 * VerifierRequest type returned by the `onNewDeviceRequest` event in `QrEngagementEvents`. The outermost key represents the credential doctype.
 * - isAuthenticated: A boolean value indicating whether the verifier app is verified or not
 * - request: The inner dictionary contains namespaces, and for each namespace, there is another dictionary mapping requested claims to a boolean value,
 * which indicates whether the verfier app wants to retain the claim or not. Example:
 *  `{
 *    "org.iso.18013.5.1.mDL": {
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
