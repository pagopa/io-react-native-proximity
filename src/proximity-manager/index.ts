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
import { CborDataItem, decode, encode } from '../cbor';
import { sleepMs, splitBufferInChunks, uuidToBuffer } from '../utils';
import { removePadding } from '@pagopa/io-react-native-jwt';
import { documentsRequestParser, type DocumentRequest } from './parser';

const SECONDS_TO_SCAN_FOR = 20;
const ALLOW_DUPLICATES = true;

const STATE_CHARACTERISTIC_UUID = '00000005-a123-48ce-896b-4c76973373e6';
const SERVER_2_CLIENT_CHARACTERISTIC_UUID =
  '00000007-a123-48ce-896b-4c76973373e6';

const CLIENT_2_SERVER_CHARACTERISTIC_UUID =
  '00000006-a123-48ce-896b-4c76973373e6';

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

/*
 * This enum is used in order to understand what state our proximity flow is in.
 * This is because communication with BLE is asynchronous and therefore not having a request/response mapping
 * it is necessary to keep track of the status to understand the generated response to which request (part of the flow)
 * it refers to.
 */
enum ProximityFlowPhases {
  DeviceEngagement = 'DeviceEngagement',
  DataPresentation = 'DataPresentation',
}

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
  let connectedPheripheral: Peripheral | undefined;

  let currentState: ProximityFlowPhases;

  // a temporary buffer is used to store the chunks of the message
  let tempBuffer: number[] = [];

  // a random UUID is used to identify the mDL-reader
  // it should be generated at the first start of the manager
  // and updated on every restart
  let randomVerifierUUID: string;

  // Device engagement Map
  let deviceEngagement: Map<number, any> = new Map();

  const eventManager = createEventManager();

  let handleDocumentsRequest: (documentsRequest: DocumentRequest[]) => void;

  let servicesId: {
    server2Client: string;
    client2Server: string;
    state: string;
  };

  // This flag is used to understand if the BLE manager is started
  // and avoid starting it multiple times causing multiple
  // connection to the same peripheral
  let isStarted = false;

  const start = () => {
    return new Promise<void>(async (resolve, reject) => {
      await session.start();
      randomVerifierUUID = uuid.v4().toString();
      if (!isStarted) {
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
            isStarted = true;
            resolve();
          })
          .catch((error) => {
            reject(error);
          });
      }
      eventManager.emit('onEvent', {
        type: 'ON_BLE_START',
        message: 'ble manager is started.',
      });
      resolve();
    });
  };

  const dataPresentation = async (mDocResponse: Buffer) => {
    currentState = ProximityFlowPhases.DataPresentation;

    const encryptedMessage = await session.encryptDeviceMessage(mDocResponse);

    const responseData = new Map();
    responseData.set('data', encryptedMessage);
    responseData.set('status', 20); //Status code 20 = Session termination

    const messageToSend = encode(responseData);
    await sendMdocResponseChunks(messageToSend);
    eventManager.emit('onEvent', {
      type: 'ON_DOCUMENT_PRESENTATION_COMPLETED',
      message: 'Document presentation completed.',
    });
  };

  const sendMdocResponseChunks = async (messageToSend: Buffer) => {
    //TODO: [SIW-764] the maximum mtu must be obtained from the native part
    const maxMtu = 512;
    if (connectedPheripheral) {
      const chunks = splitBufferInChunks(messageToSend, maxMtu - 1);
      for (let index = 0; index < chunks.length; index++) {
        let chunk = chunks[index]!;
        let bytesToSend = [];
        //if last chunk prepend 0x00 else 0x01
        if (index === chunks.length - 1) {
          bytesToSend = [0x00, ...chunk];
        } else {
          bytesToSend = [0x01, ...chunk];
        }

        //Write without response to Client2Server
        await BleManager.writeWithoutResponse(
          connectedPheripheral!.id,
          servicesId.client2Server,
          CLIENT_2_SERVER_CHARACTERISTIC_UUID,
          bytesToSend,
          maxMtu
        );

        //This sleep is necessary to prevent the BLE queue from being filled immediately
        await sleepMs(10);
      }

      //Write without response END command (0x02) to State
      await BleManager.writeWithoutResponse(
        connectedPheripheral.id,
        servicesId.state,
        STATE_CHARACTERISTIC_UUID,
        [0x02]
      );
    } else {
      throw new Error('Device not connected to any peripheral');
    }
  };

  const stop = () => {
    return new Promise<void>(async (resolve, reject) => {
      try {
        //Clean temp buffer
        tempBuffer = [];
        // Close session
        await session.close();
        // Stop BLE scan if is scanning
        await BleManager.stopScan();
        // Disconnect a pheripheral if is connected
        if (
          connectedPheripheral &&
          (await BleManager.isPeripheralConnected(connectedPheripheral.id))
        ) {
          try {
            await BleManager.stopNotification(
              connectedPheripheral.id,
              servicesId.state,
              STATE_CHARACTERISTIC_UUID
            );
          } catch (error) {
            console.log('Unable to stop notification from state', error);
          }
          try {
            await BleManager.stopNotification(
              connectedPheripheral.id,
              servicesId.server2Client,
              SERVER_2_CLIENT_CHARACTERISTIC_UUID
            );
          } catch (error) {
            console.log(
              'Unable to stop notification from Server2Client',
              error
            );
          }
          try {
            await BleManager.stopNotification(
              connectedPheripheral.id,
              servicesId.client2Server,
              CLIENT_2_SERVER_CHARACTERISTIC_UUID
            );
          } catch (error) {
            console.log(
              'Unable to stop notification from Client2Server',
              error
            );
          }
          try {
            await BleManager.disconnect(connectedPheripheral.id);
          } catch (error) {
            console.log('Unable to disconnect from pheripheral', error);
          }
        }
        resolve();
        eventManager.emit('onEvent', {
          type: 'ON_BLE_STOP',
          message: 'BleManager is stopped.',
        });
      } catch (error) {
        reject(error);
      }
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
      const eDeviceKey = await session.getDevicePublicKey();
      const coseSessionKey = fromJwkToCoseHex(eDeviceKey);

      /*
       * Security array:
       * first element: CipherSuiteIdentifier (1=EC)
       * second element: Public session key CBOR encoded with TAG 24
       */
      const security = [1, new CborDataItem(coseSessionKey)];

      const bleOptions = new Map();
      bleOptions.set(0, false); //Support server mode (false)
      bleOptions.set(1, true); //Support client mode (true)
      bleOptions.set(11, uuidToBuffer(randomVerifierUUID)); //Buffer of UUID for mdoc Client mode

      /*
       * DeviceRetrievalMethods array:
       * first element: type (2=BLE)
       * second element: version (only version 1 is supported)
       * third element: options (bleOptions)
       */
      const bleClientRetievalMethod = [2, 1, bleOptions];

      deviceEngagement.set(0, '1.0'); //set version (only 1.0 is supported)
      deviceEngagement.set(1, security); //set Security array (EDeviceKeyBytes)
      deviceEngagement.set(2, [bleClientRetievalMethod]); //set array of DeviceRetrievalMethods array (we only support one type)

      //Encode to CBOR
      const encodedDeviceEng = encode(deviceEngagement);
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
    const serviceUUIDs = peripheral.advertising.serviceUUIDs;
    if (serviceUUIDs && serviceUUIDs.includes(randomVerifierUUID)) {
      if (!connectedPheripheral) {
        BleManager.stopScan();
        connectToPeripheral(peripheral);
      }
    }
  };

  const connectToPeripheral = async (peripheral: Peripheral) => {
    connectedPheripheral = peripheral;
    await BleManager.connect(peripheral.id);
    console.debug(`[connectPeripheral][${peripheral.id}] connected.`);
    eventManager.emit('onEvent', {
      type: 'ON_PERIPHERAL_CONNECTED',
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

    const client2serverServiceId = peripheralData.characteristics?.filter(
      (c) => c.characteristic === CLIENT_2_SERVER_CHARACTERISTIC_UUID
    )[0]?.service;

    if (!stateServiceId || !server2clientServiceId || !client2serverServiceId) {
      console.error(
        `[connectPeripheral][${peripheral.id}] missing stateServiceId, server2clientServiceId or client2serverServiceId.`
      );
      eventManager.emit('onError', {
        type: 'ON_BLE_ERROR',
        message: 'missing stateServiceId or server2clientServiceId.',
      });
      return;
    }

    servicesId = {
      state: stateServiceId,
      server2Client: server2clientServiceId,
      client2Server: client2serverServiceId,
    };

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

    currentState = ProximityFlowPhases.DeviceEngagement;
    // start 0x01
    // stop 0x00
    await BleManager.writeWithoutResponse(
      peripheralData.id,
      stateServiceId,
      STATE_CHARACTERISTIC_UUID,
      [0x01]
    );
  };

  const handleDisconnectedPeripheral = async (
    data: BleDisconnectPeripheralEvent
  ) => {
    connectedPheripheral = undefined;
    await stop();
    console.debug(
      '[handleDisconnectedPeripheral] disconnected from BLE peripheral',
      data
    );
  };

  const handleStopScan = () => {
    console.debug('[handleStopScan] scan is stopped.');
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
        // Clean temp buffer
        tempBuffer = [];
        switch (currentState) {
          case ProximityFlowPhases.DeviceEngagement:
            processSessionEstablishment(buffer);
            break;
        }
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

  /**
   * This function is to remove all the listeners
   * @example
   * ProximityManager.removeListeners();
   */
  const removeListeners = () => {
    eventManager.removeAllListeners();
  };

  const setOnDocumentRequestHandler = (
    handler: typeof handleDocumentsRequest
  ) => {
    handleDocumentsRequest = handler;
  };

  const processSessionEstablishment = async (buffer: Buffer) => {
    // decode buffer in CBOR+COSE (the decode payload has the mDL reader pubkey and a cypher data)
    // and decrypt the presentation data
    const decodedReceived = decode(buffer);
    const eReaderKeyBytes = decodedReceived.get('eReaderKey');
    const encryptedDocumentsRequestBuffer = Buffer.from(
      decodedReceived.get('data')
    );

    const encodedDeviceEng = encode(deviceEngagement);

    eventManager.emit('onEvent', {
      type: 'ON_SESSION_ESTABLISHMENT',
      message: 'Session establishment is started.',
    });

    await session.startSessionEstablishment(eReaderKeyBytes, encodedDeviceEng);

    const documentsRequestDecrypted = await session.decryptReaderMessage(
      encryptedDocumentsRequestBuffer
    );

    const documentRequests = documentsRequestParser(documentsRequestDecrypted);

    handleDocumentsRequest(documentRequests);

    eventManager.emit('onEvent', {
      type: 'ON_DOCUMENT_REQUESTS_RECEIVED',
      message: 'Document requests received and parsed.',
    });
  };

  return {
    start,
    startScan,
    generateQrCode,
    setListeners,
    setOnDocumentRequestHandler,
    dataPresentation,
    removeListeners,
    stop,
  };
};

export default ProximityManager();
