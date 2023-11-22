import { NativeEventEmitter, NativeModules } from 'react-native';
import BleManager, {
  type BleDisconnectPeripheralEvent,
  type BleManagerDidUpdateValueForCharacteristicEvent,
  type Peripheral,
} from 'react-native-ble-manager';
import uuid from 'react-native-uuid';
import createEventManager, { type EventData } from './../utils/EventManager';
import session from './session';
import { fromJwkToCoseHex } from '../cbor/jwk';
import { CborDataItem, encode } from '../cbor';
import { uuidToBuffer } from '../utils';
import { removePadding } from '@pagopa/io-react-native-jwt';

/**
  * This package is a boilerplate for native modules. No native code is included here.
  * As the experimental implementation of ISO 18013-5 is not yet available, this package
  * is a placeholder for the future native implementation.
const LINKING_ERROR =
  `The package 'io-react-native-proximity' doesn't seem to be linked. Make sure: \n\n` +
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
*/

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

/**
 * ProximityManager is a singleton that manages the BLE connection with the mDL-reader.
 * It is responsible for:
 * - generating the keypair
 * - starting the BLE manager
 * - starting the BLE scan
 * - connecting to the mDL-reader
 * - sending the credential to the mDL-reader
 * - stopping the BLE scan
 * - stopping the BLE manager
 */
const ProximityManager = () => {
  const SECONDS_TO_SCAN_FOR = 7;
  const ALLOW_DUPLICATES = true;

  const STATE_CHARACTERISTIC_UUID = '00000005-A123-48CE-896B4C76973373E6';
  const SERVER_2_CLIENT_CHARACTERISTIC_UUID =
    '00000007-A123-48CE-896B4C76973373E6';

  // a temporary buffer is used to store the chunks of the message
  let tempBuffer: number[] = [];

  // a random UUID is used to identify the mDL-reader
  // it should be generated at the first start of the manager
  // and updated on every restart
  let randomVerifierUUID: string;

  const eventManager = createEventManager();

  const start = () => {
    return new Promise<void>(async (resolve, reject) => {
      await session.start();

      BleManager.start({ showAlert: false })
        .then(() => {
          bleManagerEmitter.addListener(
            'BleManagerDiscoverPeripheral',
            handleDiscoverPeripheral
          );
          bleManagerEmitter.addListener('BleManagerStopScan', handleStopScan);

          bleManagerEmitter.addListener(
            'BleManagerDisconnectPeripheral',
            handleDisconnectedPeripheral
          );

          bleManagerEmitter.addListener(
            'BleManagerDidUpdateValueForCharacteristic',
            handleUpdateValueForCharacteristic
          );
          eventManager.emit('onEvent', {
            type: 'ON_BLE_START',
            message: 'ble manager is started.',
          });
          randomVerifierUUID = uuid.v4().toString();
          resolve();
        })
        .catch((error) => {
          reject(error);
        });
    });
  };

  const stop = () => {
    return new Promise<void>(async (resolve, reject) => {
      await session.close();
      BleManager.stopScan()
        .then(() => {
          resolve();
        })
        .catch((error) => {
          reject(error);
        });
    });
  };

  /**
   * This function is called when the user wants to generate the QR code.
   * It should returns a string that is the QR code. The QR code should be
   * rendered in the UI.
   * @returns {Promise<string>} the QR code
   */
  const generateQrCode = () => {
    return new Promise<string>(async (resolve, _) => {
      const sessionKey = await session.getSessionPublicKey();
      const coseSessionKey = fromJwkToCoseHex(sessionKey);

      const security = [1, new CborDataItem(coseSessionKey)];

      const bleOptions = new Map();
      bleOptions.set(0, false); //Support server mode
      bleOptions.set(1, true); //Support client mode
      bleOptions.set(11, uuidToBuffer(randomVerifierUUID)); //UUID for mdoc Client mode
      const bleClientRetievalMethod = [2, 1, bleOptions];

      const deviceEng = new Map();
      deviceEng.set(0, '1.0'); //set version
      deviceEng.set(1, security); //set Security (EDeviceKeyBytes)
      deviceEng.set(2, [bleClientRetievalMethod]); //set DeviceRetrievalMethods

      const encodedDeviceEng = encode(deviceEng);
      const qrcode =
        'mdoc:' + removePadding(encodedDeviceEng.toString('base64'));

      resolve(qrcode);
    });
  };

  const startScan = () => {
    return new Promise<void>((resolve, reject) => {
      BleManager.scan(
        [randomVerifierUUID],
        SECONDS_TO_SCAN_FOR,
        ALLOW_DUPLICATES
      )
        .then(() => {
          resolve();
          eventManager.emit('onEvent', {
            type: 'ON_BLE_START',
            message: 'scan is started.',
          });
        })
        .catch((error) => {
          reject(error);
        });
    });
  };

  const handleDiscoverPeripheral = async (peripheral: Peripheral) => {
    if (peripheral.id === randomVerifierUUID) {
      await BleManager.stopScan();
      await BleManager.connect(peripheral.id);
      console.debug(`[connectPeripheral][${peripheral.id}] connected.`);
      eventManager.emit('onEvent', {
        type: 'ON_PERIHPERAL_CONNECTED',
        message: 'pheripheral connected.',
      });
      const peripheralData = await BleManager.retrieveServices(peripheral.id);
      console.debug(
        `[connectPeripheral][${peripheral.id}] retrieved peripheral services`,
        peripheralData
      );

      const rssi = await BleManager.readRSSI(peripheral.id);
      console.debug(
        `[connectPeripheral][${peripheral.id}] retrieved current RSSI value: ${rssi}.`
      );

      const stateServiceId = peripheralData.characteristics?.filter(
        (c) => c.characteristic === STATE_CHARACTERISTIC_UUID
      )[0]?.service;

      const server2clientServiceId = peripheralData.characteristics?.filter(
        (c) => c.characteristic === SERVER_2_CLIENT_CHARACTERISTIC_UUID
      )[0]?.service;

      if (!stateServiceId || !server2clientServiceId) {
        console.error(
          `[connectPeripheral][${peripheral.id}] missing stateServiceId or server2clientServiceId.`
        );
        eventManager.emit('onError', {
          type: 'ON_BLE_ERROR',
          message: 'missing stateServiceId or server2clientServiceId.',
        });
        return;
      }

      const startNotification = [
        BleManager.startNotification(
          peripheralData.id,
          stateServiceId,
          STATE_CHARACTERISTIC_UUID
        ),
        BleManager.startNotification(
          peripheralData.id,
          server2clientServiceId,
          SERVER_2_CLIENT_CHARACTERISTIC_UUID
        ),
      ];

      await Promise.all(startNotification);

      // start 0x01
      // stop 0x00
      await BleManager.writeWithoutResponse(
        peripheralData.id,
        stateServiceId,
        STATE_CHARACTERISTIC_UUID,
        [0x01]
      );
    }
  };

  const handleDisconnectedPeripheral = (data: BleDisconnectPeripheralEvent) => {
    console.debug(
      '[handleDisconnectedPeripheral] disconnected from BLE peripheral',
      data
    );
  };

  const handleStopScan = () => {
    console.debug('[handleStopScan] scan is stopped.');
    eventManager.emit('onEvent', {
      type: 'ON_BLE_STOP',
      message: 'scan is stopped.',
    });
  };

  const handleUpdateValueForCharacteristic = (
    data: BleManagerDidUpdateValueForCharacteristicEvent
  ) => {
    const { value, characteristic } = data;
    if (characteristic === SERVER_2_CLIENT_CHARACTERISTIC_UUID) {
      const shiftedValue = value.shift(); //Shift first byte
      tempBuffer = tempBuffer.concat(value);
      if (shiftedValue === 0x00) {
        // STOP - latest chunk
        let buffer = Buffer.from(new Uint8Array(tempBuffer)); //Copy temp buffer
        //In this case this is sessionEstablishmentBuffer
        console.log(buffer);
        // decode buffer in CBOR+COSE (the decode payload has the mDL reader pubkey)
        // and decrypt the presentation data
      }
    }
  };

  /**
   * This function is called when the mDL-reader is ready to receive the credential.
   * @param credential
   */
  /*
  const sendCredential = (credential: any) => {
    // this function send to the mDL-reader the credential
    // a new session with generated keypair should be created
    // to send the response with Ble withoutResponse method
  };
  */

  /**
   * This function is to set the listeners for the events.
   * @param listeners
   * @returns
   * @example
   * ProximityManager.setListeners({
   *  onEvent,
   *  onSuccess,
   *  onError,
   * });
   */
  const setListeners = (listeners: {
    [key: string]: (eventData: EventData) => void;
  }) => {
    Object.keys(listeners).forEach((key) => {
      const listener = listeners[key];
      if (listener) {
        eventManager.addListener(key, listener);
      }
    });
  };

  return {
    start,
    startScan,
    generateQrCode,
    setListeners,
    stop,
  };
};

export default ProximityManager();
