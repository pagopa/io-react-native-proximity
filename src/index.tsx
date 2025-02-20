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
  initializeQrEngagement(peripheralMode, centralClientMode, clearBleCache) {
    return IoReactNativeProximity.initializeQrEngagement(
      peripheralMode,
      centralClientMode,
      clearBleCache
    );
  },

  getQrCodeString() {
    return IoReactNativeProximity.getQrCodeString();
  },

  closeQrEngagement() {
    return IoReactNativeProximity.closeQrEngagement();
  },

  generateResponse(jsonDocuments, fieldRequestedAndAccepted, alias) {
    return IoReactNativeProximity.generateResponse(
      jsonDocuments,
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
