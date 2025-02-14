import { NativeEventEmitter } from 'react-native';
import IoReactNativeProximity from '../';

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
