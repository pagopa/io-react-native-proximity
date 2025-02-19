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

type QrEngagementEvents =
  | 'onConnecting'
  | 'onDeviceRetrievalHelperReady'
  | 'onCommunicationError'
  | 'onNewDeviceRequest'
  | 'onDeviceDisconnected';

interface IoReactNativeProximity {
  initializeQrEngagement(
    peripheralMode: boolean,
    centralClientMode: boolean,
    clearBleCache: boolean
  ): Promise<boolean>;

  getQrCodeString(): Promise<string>;

  closeQrEngagement(): Promise<boolean>;

  connectToIssuer(mDoc: string): Promise<boolean>;

  generateResponse(
    jsonDocuments: string,
    fieldRequestedAndAccepted: string
  ): Promise<string>;

  addListener(event: QrEngagementEvents, callback: (data?: any) => void): void;

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

  connectToIssuer(mDoc) {
    return IoReactNativeProximity.connectToIssuer(mDoc);
  },

  generateResponse(jsonDocuments, fieldRequestedAndAccepted) {
    return IoReactNativeProximity.generateResponse(
      jsonDocuments,
      fieldRequestedAndAccepted
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
