import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { KEYTAG, mdlMock, WELL_KNOWN_CREDENTIALS } from './mocks';
import {
  Proximity,
  parseVerifierRequest,
} from '@pagopa/io-react-native-proximity';
import {
  generateAcceptedFields,
  generateKeyIfNotExists,
  isRequestMdl,
  requestBlePermissions,
} from './utils';

const App = () => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const handleOnDeviceConnecting = () => {
    console.log('onDeviceConnecting');
  };

  const handleOnDeviceConnected = () => {
    console.log('onDeviceConnected');
  };

  /**
   * Handles communication errors
   * @param data The error data
   */
  const handleOnError = useCallback(
    (data: Proximity.EventsPayload['onError']) => {
      const error = JSON.stringify(data);
      console.error(`onError: ${error}`);
      closeConnection();
    },
    []
  );

  /**
   * Handles new device requests
   * @param request The request object
   * @returns The response object
   * @throws Error if the request is invalid
   * @throws Error if the response generation fails
   */
  const handleOnDocumentRequestReceived = useCallback(
    async (payload: Proximity.EventsPayload['onDocumentRequestReceived']) => {
      try {
        // A new request has been received
        console.log('onDocumentRequestReceived', payload);
        if (!payload || !payload.data) {
          console.warn('Request does not contain a message.');
          return;
        }

        // Parse and verify the received request with the exposed function
        const parsedJson = JSON.parse(payload.data);
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
        const documents: Array<Proximity.Document> = [
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
        console.log(JSON.stringify(acceptedFields));
        console.log('Accepted fields:', JSON.stringify(acceptedFields));
        const result = await Proximity.generateResponse(
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
        await Proximity.sendResponse(result);
        console.log('Response sent');
      } catch (error) {
        console.error('Error handling new device request:', error);
        await Proximity.sendErrorResponseNoData();
      }
    },
    []
  );

  const onDeviceDisconnected = useCallback(async () => {
    console.log('onDeviceDisconnected');
    Alert.alert('Device disconnected', 'Check the verifier app for the result');
    await closeConnection();
    setQrCode(null);
  }, []);

  /**
   * Getter for the QR code string.
   */
  const generateQrCode = async () => {
    try {
      console.log('Generating QR code');
      const qrString = await Proximity.getQrCodeString();
      console.log(`Generated QR code: ${qrString}`);
      setQrCode(qrString);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const start = useCallback(async () => {
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
      await Proximity.start(); // Peripheral mode
      // Register listeners
      Proximity.addListener('onDeviceConnecting', handleOnDeviceConnecting);
      Proximity.addListener('onDeviceConnected', handleOnDeviceConnected);
      Proximity.addListener(
        'onDocumentRequestReceived',
        handleOnDocumentRequestReceived
      );
      Proximity.addListener('onDeviceDisconnected', onDeviceDisconnected);
      Proximity.addListener('onError', handleOnError);

      await generateQrCode();
    } catch (error) {
      Alert.alert('Failed to initialize QR engagement');
    } finally {
      setLoading(false);
    }
  }, [handleOnDocumentRequestReceived, onDeviceDisconnected, handleOnError]);

  /**
   * Closes the QR engagement and cleans up listeners.
   */
  const closeConnection = async () => {
    console.log('Cleaning up listeners and closing QR engagement');
    Proximity.removeListener('onDeviceConnected');
    Proximity.removeListener('onDeviceConnecting');
    Proximity.removeListener('onDeviceDisconnected');
    Proximity.removeListener('onDocumentRequestReceived');
    Proximity.removeListener('onError');
    await Proximity.close();
    setQrCode(null);
  };

  useEffect(() => {
    start();

    return () => {
      closeConnection();
    };
  }, [start]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>QR Code Engagement</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#000" />
      ) : qrCode ? (
        <QRCode value={qrCode} size={200} />
      ) : (
        <Text>Click the button to generate a QR code</Text>
      )}
      <TouchableOpacity style={styles.button} onPress={start}>
        <Text style={styles.buttonText}>Generate QR Engagement</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.button}
        onPress={async () => {
          await closeConnection();
          Alert.alert('QR Engagement Closed');
        }}
      >
        <Text style={styles.buttonText}>Close QR Engagement</Text>
      </TouchableOpacity>
    </SafeAreaView>
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

export default App;
