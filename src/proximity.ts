import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type { AcceptedFields } from './schema';

const LINKING_ERROR =
  `The package '@pagopa/io-react-native-proximity' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

const IoReactNativeProximity = NativeModules.IoReactNativeProximity
  ? NativeModules.IoReactNativeProximity
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

const eventEmitter = new NativeEventEmitter(IoReactNativeProximity);

/**
 * Events emitted by the native module:
 * - `onDeviceConnecting`: Emitted when the device is connecting to the verifier app.
 * - `onDeviceConnected`: Emitted when the device is connected to the verifier app.
 * - `onDocumentRequestReceived`: Emitted when a document request is received from the verifier app. Carries a payload containing the request data.
 * - `onDeviceDisconnected`: Emitted when the device is disconnected from the verifier app.
 * - `onError`: Emitted when an error occurs. Carries a payload containing the error data.
 */
export type EventsPayload = {
  onDeviceConnecting: undefined;
  onDeviceConnected: undefined;
  // The message payload is a JSON string that must be parsed into a `VerifierRequest` structure via `parseVerifierRequest`.
  onDocumentRequestReceived: { data: string } | undefined;
  onDeviceDisconnected: undefined;
  onError: { error: string } | undefined;
};

/**
 * Events emitted by the native module.
 */
export type Events = keyof EventsPayload;

/**
 * Documents type to be used in the {@link generateResponse} method.
 * It contains the issuer signed, the alias of the bound key and the document type.
 */
export type Document = {
  issuerSignedContent: string;
  alias: string;
  docType: string;
};

/**
 * Error codes that can be used with the `sendErrorResponse` method.
 * These are defined based on the SessionData status code defined in the table 20 of the ISO 18013-5 standard
 * and mirror codes defined in the native module.
 */
export enum ErrorCode {
  SESSION_ENCRYPTION = 10,
  CBOR_DECODING = 11,
  SESSION_TERMINATED = 20,
}

/**
 * Starts the proximity flow by allocating the necessary resources and initializing the Bluetooth stack.
 * @param config.peripheralMode (Android only) - Whether the device is in peripheral mode. Defaults to true
 * @param config.centralClientMode (Android only) - Whether the device is in central client mode. Defaults to false
 * @param config.clearBleCache (Android only) - Whether the BLE cache should be cleared. Defaults to true
 * @param config.certificates - Array of base64 representing DER encoded X.509 certificate which are used to authenticate the verifier app
 */
export function start(
  config: {
    peripheralMode?: boolean;
    centralClientMode?: boolean;
    clearBleCache?: boolean;
    certificates?: string[];
  } = {}
): Promise<boolean> {
  const { peripheralMode, centralClientMode, clearBleCache, certificates } =
    config;
  if (Platform.OS === 'ios') {
    return IoReactNativeProximity.start(certificates ? certificates : []);
  } else {
    return IoReactNativeProximity.start(
      peripheralMode ? peripheralMode : true,
      centralClientMode ? centralClientMode : false,
      clearBleCache ? clearBleCache : true,
      certificates ? certificates : []
    );
  }
}

/**
 * Gets the QR code string which contains a base64url encoded CBOR object which encodes the bluetooth engagement data.
 */
export function getQrCodeString(): Promise<string> {
  return IoReactNativeProximity.getQrCodeString();
}

/**
 * Closes the QR engagement by releasing the resources allocated during the `start` method.
 * Before starting a new flow, it is necessary to call this method to ensure that the previous flow is properly closed.
 * The listeners can be removed using the `removeListener` method.
 */
export function close(): Promise<boolean> {
  return IoReactNativeProximity.close();
}

/**
 * Sends an error response to the verifier app.
 * The error code must be one of the `ErrorCode` enum values.
 * @param code - The error code to be sent to the verifier app.
 */
export function sendErrorResponse(code: ErrorCode): Promise<boolean> {
  return IoReactNativeProximity.sendErrorResponse(code);
}

/**
 * Generates a response that will be sent to the verifier app containing the requested documents.
 * @param documents - An array of `Document` which contains the requested data received from the `onNewDeviceRequest` event
 * @param acceptedFields - The accepted fields which will be presented to the verifier app. This is the same as the `request` field in the `VerifierRequest` object.
 * The outermost key represents the credential doctype. The inner dictionary contains namespaces, and for each namespace, there is another dictionary mapping requested claims to a boolean value, which indicates whether the user is willing to present the corresponding claim. Example:
 * `{
 *    "org.iso.18013.5.1.mDL": {
 *      "org.iso.18013.5.1": {
 *        "hair_colour": true,
 *        "given_name_national_character": true,
 *        "family_name_national_character": true,
 *        "given_name": true,
 *     }
 *    }
 *  }`
 * @returns A base64 encoded response to be sent to the verifier app via `sendResponse`
 */
export function generateResponse(
  documents: Array<Document>,
  acceptedFields: AcceptedFields
): Promise<string> {
  return IoReactNativeProximity.generateResponse(documents, acceptedFields);
}

/**
 * Sends the response generated through the `generateResponse` method to the verifier app.
 * Currently there's not evidence of the verifier app responding to this request, thus we don't handle the response.
 * @param response - The base64 encoded response to be sent to the verifier app.
 */
export function sendResponse(response: string): Promise<boolean> {
  return IoReactNativeProximity.sendResponse(response);
}

/**
 * Adds a listener for a `QrEngagementEvents` event which will be emitted by the native module.
 * The callback will be called with the event payload when the event is emitted.
 * @param event - The event to listen for. The available events are defined in the `QrEngagementEvents` type.
 * @param callback - The callback to be called when the event is emitted. The callback will receive the event payload as an argument.
 */
export function addListener<E extends Events>(
  event: E,
  callback: (data: EventsPayload[E]) => void
) {
  eventEmitter.addListener(event, callback);
}

/**
 * Removes a listener for a `QrEngagementEvents` event.
 * @param event - The event to remove the listener for. The available events are defined in the `QrEngagementEvents` type.
 */
export function removeListener(event: Events) {
  eventEmitter.removeAllListeners(event);
}
