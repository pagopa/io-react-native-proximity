import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCodeScanner,
} from 'react-native-vision-camera';
import { requestCameraPermission } from '../utils/permissions';
import ProximityModule from '@pagopa/io-react-native-proximity';

export const QrScannerScreen: React.FC = () => {
  const [isActive, setIsActive] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [scannedData, setScannedData] = useState<string | null>(null);
  const device = useCameraDevice('back');

  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'ean-13'],
    onCodeScanned: (codes) => {
      console.log(`Scanned ${codes.length} codes!`);
      if (codes && codes[0]?.value) {
        onQrCodeScanned(codes[0].value);
      }
    },
  });

  useEffect(() => {
    const checkPermissions = async () => {
      const granted = await requestCameraPermission();
      setHasPermission(granted);
    };
    checkPermissions();
  }, []);

  const onQrCodeScanned = async (qrData: string) => {
    if (scannedData) return; // Prevent multiple scans
    setScannedData(qrData);
    setIsActive(false);
    Alert.alert('QR Scanned', `Connecting with: ${qrData}`);

    try {
      await ProximityModule.initializeQrEngagement(false, true, true); // Central mode
      console.log('BLE Connection Initiated');
      await ProximityModule.connectToIssuer(qrData);
    } catch (error) {
      console.error('Connection Error:', error);
      Alert.alert('Error', 'Failed to connect using QR data.');
    }
  };

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>
          Camera permission is required to scan QR codes.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Scan QR Code</Text>
      {device && isActive && (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={isActive}
          codeScanner={codeScanner}
        />
      )}
      {scannedData && (
        <Text style={styles.scannedText}>Scanned: {scannedData}</Text>
      )}
      <TouchableOpacity
        style={styles.button}
        onPress={() => setScannedData(null)}
      >
        <Text style={styles.buttonText}>Scan Again</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  permissionText: {
    fontSize: 18,
    color: 'red',
  },
  camera: {
    width: '100%',
    height: 400,
  },
  scannedText: {
    fontSize: 18,
    marginTop: 10,
    color: 'green',
  },
  button: {
    marginTop: 20,
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
  },
});
