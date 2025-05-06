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
import * as ProximityModule from '@pagopa/io-react-native-proximity';
import { KEYTAG, mdlMock, WELL_KNOWN_CREDENTIALS } from '../mocks';
import type { QrEngagementEventPayloads } from '@pagopa/io-react-native-proximity';
import { parseVerifierRequest } from '../../../src/schema';
import {
  generateAcceptedFields,
  generateKeyIfNotExists,
  isRequestMdl,
  requestBlePermissions,
} from '../utils';

export const QrCodeScreen: React.FC = () => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

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
        // A new request has been received
        console.log('New device request received', data);
        if (!data || !data.message) {
          console.warn('Request does not contain a message.');
          return;
        }

        // Parse and verify the received request with the exposed function
        const message = data.message;
        const parsedJson = JSON.parse(message);
        console.log('Parsed JSON:', parsedJson);
        const parsedResponse = parseVerifierRequest(parsedJson);
        console.log('Parsed response:', JSON.stringify(parsedResponse));

        /*
        Currently only supporting mDL requests thus we check if the requests consists of a single credential       
        and if the credential is of type mDL.
        */
        isRequestMdl(Object.keys(parsedResponse.request));

        /**
         * Generate a crypto key pair which will be provided along with the response.
         * This will make the signature check invalid because they generate key is not the same as the one used to sign the mock credential.
         */
        console.log('MDL request found. Sending document...');
        await generateKeyIfNotExists(KEYTAG);
        const documents: Array<ProximityModule.Document> = [
          {
            alias: KEYTAG,
            docType: WELL_KNOWN_CREDENTIALS.mdl,
            issuerSignedContent: mdlMock,
          },
        ];

        /*
         * Generate the response to be sent to the verifier app. Currently we blindly accept all the fields requested by the verifier app.
         * In an actual implementation, the user would be prompted to accept or reject the requested fields and the `acceptedFields` object
         * must be generated according to the user's choice, setting the value to true for the accepted fields and false for the rejected ones.
         * See the `generateResponse` method for more details.
         */
        console.log('Generating response');
        const acceptedFields = generateAcceptedFields(parsedResponse.request);
        console.log('Accepted fields:', JSON.stringify(acceptedFields));
        const result = await ProximityModule.generateResponse(
          documents,
          acceptedFields
        );
        console.log('Response generated:', result);

        /**
         * Send the response to the verifier app.
         * Currently we don't know what the verifier app responds with, thus we don't handle the response.
         * We just wait for 2 seconds before closing the connection and resetting the QR code.
         * In order to start a new flow a new QR code must be generated.
         */
        console.log('Sending response to verifier app');
        await ProximityModule.sendResponse(result);
        console.log('Response sent, closing connection in 2 seconds');
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await ProximityModule.closeQrEngagement();
        setQrCode(null);
      } catch (error) {
        console.error('Error handling new device request:', error);
        await ProximityModule.sendErrorResponseNoData();
      }
    },
    []
  );

  /**
   * Getter for the QR code string.
   */
  const getQrCode = async () => {
    try {
      console.log('Generating QR code');
      const qrString = await ProximityModule.getQrCodeString();
      console.log(`Generated QR code: ${qrString}`);
      setQrCode(qrString);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  /**
   * Closes the QR engagement and cleans up listeners.
   */
  const closeConnection = async () => {
    console.log('Cleaning up listeners and closing QR engagement');
    ProximityModule.removeListeners('onDeviceRetrievalHelperReady');
    ProximityModule.removeListeners('onCommunicationError');
    ProximityModule.removeListeners('onNewDeviceRequest');
    await ProximityModule.closeQrEngagement();
  };

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
