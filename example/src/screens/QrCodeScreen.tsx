import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import ProximityModule from '@pagopa/io-react-native-proximity';
import { requestBlePermissions } from '../utils/permissions';

export const QrCodeScreen: React.FC = () => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const initialize = async () => {
      const hasPermission = await requestBlePermissions();
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'BLE permissions are needed to proceed.'
        );
        setLoading(false);
        return;
      }
      try {
        await ProximityModule.initializeQrEngagement(true, false, true); // Peripheral mode
      } catch (error) {
        Alert.alert('Failed to initialize QR engagement');
      } finally {
        setLoading(false);
      }
    };

    initialize();

    return () => {
      ProximityModule.closeQrEngagement();
    };
  }, []);

  useEffect(() => {
    const handleDeviceReady = () => {
      console.log('Device is ready for retrieval');
    };

    const handleError = (message: string) => {
      console.error('QR Engagement Error:', message);
    };

    ProximityModule.addListener(
      'onDeviceRetrievalHelperReady',
      handleDeviceReady
    );
    ProximityModule.addListener('onCommunicationError', handleError);

    return () => {
      ProximityModule.removeListeners('onDeviceRetrievalHelperReady');
      ProximityModule.removeListeners('onCommunicationError');
    };
  }, []);

  const getQrCode = async () => {
    const qrString = await ProximityModule.getQrCodeString();
    setQrCode(qrString);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>QR Code Engagement</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#000" />
      ) : qrCode ? (
        <QRCode value={qrCode} size={200} />
      ) : (
        <Text>Click the button to generate a qr code</Text>
      )}
      <TouchableOpacity style={styles.button} onPress={getQrCode}>
        <Text style={styles.buttonText}>Generate QR Engagement</Text>
      </TouchableOpacity>
      <Text style={styles.text}>{qrCode}</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          ProximityModule.closeQrEngagement();
          Alert.alert('QR Engagement Closed');
          setQrCode(null);
        }}
      >
        <Text style={styles.buttonText}>Close QR Engagement</Text>
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
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  text: {
    fontSize: 18,
    marginBottom: 20,
    color: '#333',
  },
  errorText: {
    color: 'red',
    fontSize: 16,
  },
  button: {
    margin: 10,
    backgroundColor: '#007AFF',
    padding: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
  },
});
