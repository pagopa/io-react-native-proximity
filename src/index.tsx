import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

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

export type QrEngagementEventPayloads = {
  onConnecting: undefined;
  onDeviceRetrievalHelperReady: undefined;
  onCommunicationError: { error: string } | undefined;
  onNewDeviceRequest: { message: string } | undefined;
  onDeviceDisconnected: undefined;
};

export type QrEngagementEvents = keyof QrEngagementEventPayloads;

interface IoReactNativeProximity {
  initializeQrEngagement(
    peripheralMode: boolean,
    centralClientMode: boolean,
    clearBleCache: boolean
  ): Promise<boolean>;

  getQrCodeString(): Promise<string>;

  closeQrEngagement(): Promise<boolean>;

  sendErrorResponse(): Promise<boolean>;

  sendErrorResponseNoData(): Promise<boolean>;

  generateResponse(
    jsonDocuments: string,
    fieldRequestedAndAccepted: string,
    alias: string
  ): Promise<string>;

  addListener<E extends QrEngagementEvents>(
    event: E,
    callback: (data: QrEngagementEventPayloads[E]) => void
  ): void;

  removeListeners(event: QrEngagementEvents): void;
}

const eventEmitter = new NativeEventEmitter(IoReactNativeProximity);

const ProximityModule: IoReactNativeProximity = {
  /**
   * Initializes the QR engagement
   * @android This method should be called before any other method in this module.
   * @ios This method is not needed for iOS since the getQrCodeString method is responsible for initializing the connection
   * @param peripheralMode - Whether the device is in peripheral mode
   * @param centralClientMode - Whether the device is in central client mode
   * @param clearBleCache - Whether the BLE cache should be cleared
   */
  initializeQrEngagement(peripheralMode, centralClientMode, clearBleCache) {
    // This is not needed for iOS since the getQrCodeString method is responsible for initializing the connection
    if (Platform.OS === 'ios') {
      return Promise.resolve(true);
    }
    return IoReactNativeProximity.initializeQrEngagement(
      peripheralMode,
      centralClientMode,
      clearBleCache
    );
  },

  /**
   * Gets the QR code string
   * @ios This method is responsible for initializing the connection and retrieving the QR code string
   * @android Returns the QR code string
   */
  getQrCodeString() {
    return IoReactNativeProximity.getQrCodeString();
  },

  /**
   * Closes the QR engagement
   */
  closeQrEngagement() {
    return IoReactNativeProximity.closeQrEngagement();
  },

  /**
   * Sends a generic error response to the verifier app
   */
  sendErrorResponse(): Promise<boolean> {
    return IoReactNativeProximity.sendErrorResponse();
  },

  /**
   * Sends an error response to the verifier app when the requested document is not found
   */
  sendErrorResponseNoData(): Promise<boolean> {
    return IoReactNativeProximity.sendErrorResponseNoData();
  },

  /**
   * Generates a response that will be sent to the verifier app containing the requested data
   * @param documentCBOR - Base64 encoded string that represents the CBOR document
   * @param fieldRequestedAndAccepted - JSON object containing the accepted fields
   * @param alias - The key alias to use for signing the response
   */
  generateResponse(documentCBOR, fieldRequestedAndAccepted, alias) {
    return IoReactNativeProximity.generateResponse(
      documentCBOR,
      fieldRequestedAndAccepted,
      alias
    );
  },

  addListener(event, callback) {
    eventEmitter.addListener(event, callback);
  },

  removeListeners(event) {
    eventEmitter.removeAllListeners(event);
  },
};

export default ProximityModule;
