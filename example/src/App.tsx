import { useEffect, useState } from 'react';
import { View, Text, Button, PermissionsAndroid, Platform } from 'react-native';
import ProximityModule from '@pagopa/io-react-native-proximity';
import { BleManager } from 'react-native-ble-plx';
import QRCode from 'react-native-qrcode-svg';
import { Camera, useCameraDevices } from 'react-native-vision-camera';
import CBOR from '@pagopa/io-react-native-cbor';

const bleManager = new BleManager();

const requestPermissions = async () => {
  if (Platform.OS === 'android') {
    await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ]);
  }
  const cameraPermission = await Camera.requestCameraPermission();
  if (cameraPermission !== 'authorized') {
    console.warn('Camera permission not granted');
  }
};

const ProximityExample = () => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState<boolean>(false);
  const [publicKey, setPublicKey] = useState(null);
  const [privateKey, setPrivateKey] = useState(null);
  const devices = useCameraDevices();
  const [selectedDevice, setSelectedDevice] = useState(null);

  useEffect(() => {
    requestPermissions();

    ProximityModule.addListener('onDeviceRetrievalHelperReady', () => {
      console.log('Device Retrieval Helper Ready');
      setSessionActive(true);
    });

    ProximityModule.addListener('onDeviceDisconnected', () => {
      console.log('Device Disconnected');
      setSessionActive(false);
    });

    return () => {
      ProximityModule.removeListeners('onDeviceRetrievalHelperReady');
      ProximityModule.removeListeners('onDeviceDisconnected');
    };
  }, [devices]);

  const startSlave = async () => {
    await ProximityModule.initializeQrEngagement(true, true, false);
    const qrString = await ProximityModule.getQrCodeString();
    setQrCode(qrString);
    console.log('Generated QR:', qrString);
  };

  const scanAndExtractDeviceEngagement = async (qrCodeString) => {
    try {
      const decoded = await CBOR.decode(qrCodeString);
      console.log('Decoded Device Engagement:', decoded);
      const eDevicePubKey = decoded[1][1][2];
      setPublicKey(eDevicePubKey);
      generateReaderKeys(eDevicePubKey);
    } catch (error) {
      console.error('Error decoding Device Engagement:', error);
    }
  };

  const generateReaderKeys = async (eDevicePubKey) => {};

  const establishSession = async (keyPair, eDevicePubKey) => {};

  const startMaster = () => {
    console.log('Scanning for BLE devices...');
    bleManager.startDeviceScan(
      null,
      { allowDuplicates: false },
      (error, device) => {
        if (error) {
          console.error(error);
          return;
        }
        console.log('Discovered device:', device.name);
      }
    );
  };

  const sendMdocRequest = async () => {
    if (!sessionActive) {
      console.warn('Session is not active');
      return;
    }
    console.log('Sending mDoc request...');
    await ProximityModule.generateResponse('{}', '{}')
      .then((response) => console.log('Received response:', response))
      .catch((error) => console.error('Error in response:', error));
  };

  const closeSession = async () => {
    console.log('Closing session...');
    await ProximityModule.closeQrEngagement()
      .then(() => setSessionActive(false))
      .catch((error) => console.error('Error closing session:', error));
  };

  return (
    <View style={{ padding: 20, alignItems: 'center' }}>
      <Text style={{ fontSize: 18, marginBottom: 10 }}>Proximity Example</Text>
      <Button title="Start Slave (Generate QR)" onPress={startSlave} />
      {qrCode && (
        <View style={{ marginTop: 20, alignItems: 'center' }}>
          <Text>Scan this QR Code:</Text>
          <QRCode value={qrCode} size={200} />
        </View>
      )}
      <Button
        title="Start Master (Scan & Extract QR)"
        onPress={() => scanAndExtractDeviceEngagement(qrCode)}
      />
      {sessionActive && (
        <Button title="Send mDoc Request" onPress={sendMdocRequest} />
      )}
      {sessionActive && <Button title="Close Session" onPress={closeSession} />}
    </View>
  );
};

export default ProximityExample;
