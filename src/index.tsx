import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type { VerifierRequest } from './schema';

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

export type QrEngagementEventPayloads = {
  onConnecting: undefined;
  onDeviceRetrievalHelperReady: undefined;
  onCommunicationError: { error: string } | undefined;
  // The message payload is a JSON string that must be parsed into a `VerifierRequest` structure via `parseVerifierRequest`.
  onNewDeviceRequest: { message: string } | undefined;
  onDeviceDisconnected: undefined;
};

export type QrEngagementEvents = keyof QrEngagementEventPayloads;

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
 * Initializes the QR engagement
 * @android This method should be called before any other method in this module.
 * @ios This method is not needed for iOS since the getQrCodeString method is responsible for initializing the connection
 * @param peripheralMode - Whether the device is in peripheral mode
 * @param centralClientMode - Whether the device is in central client mode
 * @param clearBleCache - Whether the BLE cache should be cleared
 */
export function initializeQrEngagement(
  peripheralMode: boolean,
  centralClientMode: boolean,
  clearBleCache: boolean
): Promise<boolean> {
  // This is not needed for iOS since the getQrCodeString method is responsible for initializing the connection
  if (Platform.OS === 'ios') {
    return Promise.resolve(true);
  }
  return IoReactNativeProximity.initializeQrEngagement(
    peripheralMode,
    centralClientMode,
    clearBleCache
  );
}

/**
 * Gets the QR code string this method is responsible for initializing the connection and retrieving the QR code string
 */
export function getQrCodeString(): Promise<string> {
  return IoReactNativeProximity.getQrCodeString();
}

/**
 * Closes the QR engagement
 */
export function closeQrEngagement(): Promise<boolean> {
  return IoReactNativeProximity.closeQrEngagement();
}

/**
 * Sends a generic error response to the verifier app
 */
export function sendErrorResponse(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    // Currently not implemented for iOS
    return Promise.resolve(true);
  }
  return IoReactNativeProximity.sendErrorResponse();
}

/**
 * Sends an error response to the verifier app when the requested document is not found.
 */
export function sendErrorResponseNoData(): Promise<boolean> {
  return IoReactNativeProximity.sendErrorResponseNoData();
}

/**
 * Generates a response that will be sent to the verifier app containing the requested data
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
  acceptedFields: VerifierRequest['request']
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
export function addListener<E extends QrEngagementEvents>(
  event: E,
  callback: (data: QrEngagementEventPayloads[E]) => void
) {
  eventEmitter.addListener(event, callback);
}

/**
 * Removes a listener for a `QrEngagementEvents` event.
 * @param event - The event to remove the listener for. The available events are defined in the `QrEngagementEvents` type.
 */
export function removeListeners(event: QrEngagementEvents) {
  eventEmitter.removeAllListeners(event);
}
