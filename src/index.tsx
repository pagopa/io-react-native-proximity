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
 * Gets the QR code string
 * @ios This method is responsible for initializing the connection and retrieving the QR code string
 * @android Returns the QR code string
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
    return Promise.resolve(true);
  }
  return IoReactNativeProximity.sendErrorResponse();
}

/**
 * Sends an error response to the verifier app when the requested document is not found
 */
export function sendErrorResponseNoData(): Promise<boolean> {
  return IoReactNativeProximity.sendErrorResponseNoData();
}

/**
 * Generates a response that will be sent to the verifier app containing the requested data
 * @param issuerSignedContent - Base64 encoded string that represents the CBOR document
 * @param alias - The key alias to use for signing the response
 * @param docType - The document type of issuerSignedContent
 * @param fieldRequestedAndAccepted - JSON object containing the accepted fields
 * @param alias - The key alias to use for signing the response
 */
export function generateResponse(
  documents: Array<Document>,
  acceptedFields: VerifierRequest['request']
): Promise<string> {
  return IoReactNativeProximity.generateResponse(documents, acceptedFields);
}

export function sendResponse(response: string): Promise<boolean> {
  return IoReactNativeProximity.sendResponse(response);
}

export function addListener<E extends QrEngagementEvents>(
  event: E,
  callback: (data: QrEngagementEventPayloads[E]) => void
) {
  eventEmitter.addListener(event, callback);
}

export function removeListeners(event: QrEngagementEvents) {
  eventEmitter.removeAllListeners(event);
}
