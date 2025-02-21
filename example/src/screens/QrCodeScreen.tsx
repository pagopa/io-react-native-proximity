import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import ProximityModule, {
  type QrEngagementEventPayloads,
} from '@pagopa/io-react-native-proximity';
import { requestBlePermissions } from '../utils/permissions';
import { parseVerifierRequest } from '../../../src/schema';
import { mdlMockBase64 } from '../mocks';
import {
  type CryptoError,
  deleteKey,
  generate,
} from '@pagopa/io-react-native-crypto';

export const WELL_KNOWN_CREDENTIALS = {
  mdl: 'org.iso.18013.5.1.mDL',
} as const;

const KEYTAG = 'TEST_PROXIMITY_KEYTAG';

export const QrCodeScreen: React.FC = () => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  /**
   * Generates a key pair if it does not exist
   * @param keyTag The key tag to use
   */
  const generateKeyIfNotExists = async (keyTag: string) => {
    await deleteKey(keyTag).catch((e) => {
      const { message } = e as CryptoError;
      if (message !== 'PUBLIC_KEY_NOT_FOUND') throw e;
    });
    await generate(keyTag);
  };

  // Event handlers

  /**
   * Handles the device ready event
   */
  const handleDeviceReady = () => {
    console.log('Device is ready for retrieval');
  };

  /**
   * Handles communication errors
   * @param data The error data
   */
  const handleCommunicationError = (
    data: QrEngagementEventPayloads['onCommunicationError']
  ) => {
    console.error('QR Engagement Error:', JSON.stringify(data));
  };

  /**
   * Handles new device requests
   * @param request The request object
   * @returns The response object
   * @throws Error if the request is invalid
   * @throws Error if the response generation fails
   */
  const handleNewDeviceRequest = useCallback(
    async (data: QrEngagementEventPayloads['onNewDeviceRequest']) => {
      try {
        console.log('New device request received', data);
        if (!data || !data.message) {
          console.warn('Request does not contain a message.');
          return;
        }
        const message = data.message;

        const parsedJson = JSON.parse(message);

        // Validate using Zod with parse
        const parsedResponse = parseVerifierRequest(parsedJson);
        console.log('Parsed response:', JSON.stringify(parsedResponse));

        // Ensure that the request object has exactly one key and it matches the expected key
        const requestKeys = Object.keys(parsedResponse.request);

        if (requestKeys.length !== 1) {
          console.warn(
            'Unexpected request keys. Expected only one key but got:',
            requestKeys
          );
          await ProximityModule.sendErrorResponseNoData();
          return;
        }
        if (requestKeys[0] !== WELL_KNOWN_CREDENTIALS.mdl) {
          console.warn(
            'Unexpected request keys. Expected only key:',
            WELL_KNOWN_CREDENTIALS.mdl,
            'but got:',
            requestKeys
          );
          await ProximityModule.sendErrorResponseNoData();
          return;
        }

        console.log('MDL request found. Sending document...');
        // Generate the response payload
        const responsePayload = JSON.stringify(parsedResponse.request);
        // Generate the key pair if it does not exist
        await generateKeyIfNotExists(KEYTAG);
        // Generate the response using the mocked CBOR credential
        const result = await ProximityModule.generateResponse(
          mdlMockBase64,
          responsePayload,
          KEYTAG
        );
        console.log('Response generated:', result);
        //closeConnection();
      } catch (error) {
        console.error(
          'Error handling new device request:',
          JSON.stringify(error)
        );
        await ProximityModule.sendErrorResponse();
      }
    },
    []
  );

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
        // Initialize the QR engagement as peripheral mode
        await ProximityModule.initializeQrEngagement(true, false, true); // Peripheral mode
        // Register listeners
        ProximityModule.addListener(
          'onDeviceRetrievalHelperReady',
          handleDeviceReady
        );
        ProximityModule.addListener(
          'onCommunicationError',
          handleCommunicationError
        );
        ProximityModule.addListener(
          'onNewDeviceRequest',
          handleNewDeviceRequest
        );
      } catch (error) {
        Alert.alert('Failed to initialize QR engagement');
      } finally {
        setLoading(false);
      }
    };

    initialize();

    return () => {
      closeConnection();
    };
  }, [handleNewDeviceRequest]);

  const getQrCode = async () => {
    try {
      const qrString = await ProximityModule.getQrCodeString();
      setQrCode(qrString);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const closeConnection = async () => {
    console.log('Cleaning up listeners and closing QR engagement');
    ProximityModule.removeListeners('onDeviceRetrievalHelperReady');
    ProximityModule.removeListeners('onCommunicationError');
    ProximityModule.removeListeners('onNewDeviceRequest');
    await ProximityModule.closeQrEngagement();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>QR Code Engagement</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#000" />
      ) : qrCode ? (
        <QRCode value={qrCode} size={200} />
      ) : (
        <Text>Click the button to generate a QR code</Text>
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
