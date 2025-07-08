import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { KEYTAG, mdlMock, WELL_KNOWN_CREDENTIALS } from './mocks';
import {
  parseError,
  parseVerifierRequest,
  Proximity,
  type VerifierRequest,
} from '@pagopa/io-react-native-proximity';
import {
  generateAcceptedFields,
  generateKeyIfNotExists,
  requestBlePermissions,
} from './utils';

/**
 * Proximity status enum to track the current state of the flow.
 * - STARTING: The flow is starting, permissions are being requested if necessary.
 * - STARTED: The flow has started, the QR code is being displayed.
 * - PRESENTING: The verifier app has requested a document, the user must decide whether to send it or not.
 * - STOPPED: The flow has been stopped, either by the user or due to an error.
 */
enum PROXIMITY_STATUS {
  STARTING = 'STARTING',
  STARTED = 'STARTED',
  PRESENTING = 'PRESENTING',
  STOPPED = 'STOPPED',
}

const App: React.FC = () => {
  const [status, setStatus] = useState<PROXIMITY_STATUS>(
    PROXIMITY_STATUS.STARTING
  );
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [request, setRequest] = useState<VerifierRequest['request'] | null>(
    null
  );

  /**
   * Callback function to handle device connection.
   * Currently does nothing but can be used to update the UI
   */
  const handleOnDeviceConnecting = () => {
    console.log('onDeviceConnecting');
  };

  /**
   * Callback function to handle device connection.
   * Currently does nothing but can be used to update the UI
   */
  const handleOnDeviceConnected = () => {
    console.log('onDeviceConnected');
  };

  /**
   * Sends the required document to the verifier app.
   * @param verifierRequest - The request object received from the verifier app
   */
  const sendDocument = async (verifierRequest: VerifierRequest['request']) => {
    await generateKeyIfNotExists(KEYTAG);
    await generateKeyIfNotExists('WIA_KEYTAG');
    const documents: Array<Proximity.Document> = [
      {
        alias: 'WIA_KEYTAG',
        docType: 'org.iso.18013.5.1.IT.WalletAttestation',
        issuerSignedContent:
          'uQACamlzc3VlckF1dGiEQ6EBJqIEWCtRMXlWeUdaUTloRkUyTUVjc1pOX3ItMldjY3JoS1BnaXJwWlItcENrb00wGCGAWQIP2BhZAgq5AAZndmVyc2lvbmMxLjBvZGlnZXN0QWxnb3JpdGhtZ1NIQS0yNTZsdmFsdWVEaWdlc3RzoXRvcmcuaXNvLjE4MDEzLjUuMS5JVKQAWCAi87HROT5p3ZKLZfoHAF6tl9wfdLMP/1g2X2AsjUYTsQFYIKvRF3tA2MHtnHtJrbzpAzhOEQ6TEMyqO33sHHKMCpByAlgg0R9ydpXHU5cVof8iMDHXIs/ubh2vp38clo/C/63e9MIDWCALZcOFmnqdBGgMsQCAY4aWt3PA+3JURLjh+UFV8+cQw21kZXZpY2VLZXlJbmZvuQABaWRldmljZUtleaUgAQJ4KzBRMV9jUEQyS2dkUW9zRF9PeWVqQjg5LWRPUUJGdjdMeG9abzNqOFFuQzgBAiFYIAt4kkV2huMDs/w6Zg9vOLYwuZh02jhEjl1KH9EoD4pnIlghAL0X4oA8ZI9pX7GhZdhOoqaIxOmOspQ0asf9ofrZO+r7Z2RvY1R5cGV4Jm9yZy5pc28uMTgwMTMuNS4xLklULldhbGxldEF0dGVzdGF0aW9ubHZhbGlkaXR5SW5mb7kAA2ZzaWduZWTAdDIwMjUtMDctMDhUMTM6NTk6MDBaaXZhbGlkRnJvbcB0MjAyNS0wNy0wOFQxMzo1OTowMFpqdmFsaWRVbnRpbMB0MjAyNS0wNy0wOFQxNDo1OTowMFpYQP9oKhhMgso3+chSUcS4DKhPo/l9LrJAxJWXed9AS2XeUtEDoNDsEjEf8eI8tmxVvzAh20UjfgFS+h2t5ufDXOlqbmFtZVNwYWNlc6F0b3JnLmlzby4xODAxMy41LjEuSVSE2BhYfqRoZGlnZXN0SUQAcWVsZW1lbnRJZGVudGlmaWVyY2FhbGxlbGVtZW50VmFsdWV4JWh0dHBzOi8vd2FsbGV0LmlvLnBhZ29wYS5pdC9Mb0EvYmFzaWNmcmFuZG9tWCAMu4wnxw8hveQFL+9FdOsWWssxErtE4XiE8cjdhZsweNgYWISkaGRpZ2VzdElEAXFlbGVtZW50SWRlbnRpZmllcmNzdWJsZWxlbWVudFZhbHVleCswUTFfY1BEMktnZFFvc0RfT3llakI4OS1kT1FCRnY3THhvWm8zajhRbkM4ZnJhbmRvbVggX3dwX3Bdi6Q7JUVBjp6KXOo0diru4OfINCLrhgKKe4nYGFh8pGhkaWdlc3RJRAJxZWxlbWVudElkZW50aWZpZXJrd2FsbGV0X2xpbmtsZWxlbWVudFZhbHVleBtodHRwczovL3dhbGxldC5pby5wYWdvcGEuaXRmcmFuZG9tWCA8VKpAwByrFnwKjSt+2t6vP9R/APh9GqMBvXFF/Ss+T9gYWGmkaGRpZ2VzdElEA3FlbGVtZW50SWRlbnRpZmllcmt3YWxsZXRfbmFtZWxlbGVtZW50VmFsdWVpSVQgV2FsbGV0ZnJhbmRvbVggbT/OKdYgyA6ixFQ5MBECuWjBnp6YDHAlxTi1eFPcoLE=',
      },
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
    const acceptedFields = generateAcceptedFields(verifierRequest);
    console.log(JSON.stringify(acceptedFields));
    console.log('Accepted fields:', JSON.stringify(acceptedFields));
    const result = await Proximity.generateResponse(documents, acceptedFields);
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
  };

  /**
   * Close utility function to close the proximity flow.
   */
  const closeFlow = useCallback(async (sendError: boolean = false) => {
    try {
      if (sendError) {
        await Proximity.sendErrorResponse(
          Proximity.ErrorCode.SESSION_TERMINATED
        );
      }
      console.log('Cleaning up listeners and closing QR engagement');
      Proximity.removeListener('onDeviceConnected');
      Proximity.removeListener('onDeviceConnecting');
      Proximity.removeListener('onDeviceDisconnected');
      Proximity.removeListener('onDocumentRequestReceived');
      Proximity.removeListener('onError');
      await Proximity.close();
      setQrCode(null);
      setRequest(null);
      setStatus(PROXIMITY_STATUS.STOPPED);
    } catch (e) {
      console.log('Error closing the proximity flow', e);
    }
  }, []);

  /**
   * Callback function to handle device disconnection.
   */
  const onDeviceDisconnected = useCallback(async () => {
    console.log('onDeviceDisconnected');
    Alert.alert('Device disconnected', 'Check the verifier app');
    await closeFlow();
  }, [closeFlow]);

  /**
   * Callback function to handle errors.
   * @param data The error data
   */
  const onError = useCallback(
    async (data: Proximity.EventsPayload['onError']) => {
      try {
        if (!data || !data.error) {
          throw new Error('No error data received');
        }
        const parsedError = parseError(data.error);
        console.error(`onError: ${parsedError}`);
      } catch (e) {
        console.error('Error parsing onError data:', e);
      } finally {
        // Close the flow on error
        await closeFlow();
      }
    },
    [closeFlow]
  );

  /**
   * Sends an error response to the verifier app during the presentation.
   * @param errorCode The error code to be sent
   */
  const sendError = useCallback(async (errorCode: Proximity.ErrorCode) => {
    try {
      console.log('Sending error response to verifier app');
      await Proximity.sendErrorResponse(errorCode);
      setStatus(PROXIMITY_STATUS.STOPPED);
      console.log('Error response sent');
    } catch (error) {
      console.error('Error sending error response:', error);
      Alert.alert('Failed to send error response');
    }
  }, []);

  /**
   * Callback function to handle a new request received from the verifier app.
   * @param request The request object
   * @returns The response object
   * @throws Error if the request is invalid
   * @throws Error if the response generation fails
   */
  const onDocumentRequestReceived = useCallback(
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
        isRequestMdl(Object.keys(parsedResponse.request));
*/
        console.log('MDL request found');
        setRequest(parsedResponse.request);
        setStatus(PROXIMITY_STATUS.PRESENTING);
      } catch (error) {
        console.error('Error handling new device request:', error);
        sendError(Proximity.ErrorCode.SESSION_TERMINATED);
      }
    },
    [sendError]
  );

  /**
   * Start utility function to start the proximity flow.
   */
  const startFlow = useCallback(async () => {
    setStatus(PROXIMITY_STATUS.STARTING);
    const hasPermission = await requestBlePermissions();
    if (!hasPermission) {
      Alert.alert(
        'Permission Required',
        'BLE permissions are needed to proceed.'
      );
      setStatus(PROXIMITY_STATUS.STOPPED);
      return;
    }
    try {
      await Proximity.start({
        certificates: [],
      });
      // Register listeners
      Proximity.addListener('onDeviceConnecting', handleOnDeviceConnecting);
      Proximity.addListener('onDeviceConnected', handleOnDeviceConnected);
      Proximity.addListener(
        'onDocumentRequestReceived',
        onDocumentRequestReceived
      );
      Proximity.addListener('onDeviceDisconnected', onDeviceDisconnected);
      Proximity.addListener('onError', onError);

      // Generate the QR code string
      console.log('Generating QR code');
      const qrString = await Proximity.getQrCodeString();
      console.log(`Generated QR code: ${qrString}`);
      setQrCode(qrString);
      setStatus(PROXIMITY_STATUS.STARTED);
    } catch (error) {
      console.log('Error starting the proximity flow', error);
      Alert.alert('Failed to initialize QR engagement');
      setStatus(PROXIMITY_STATUS.STOPPED);
    }
  }, [onDeviceDisconnected, onDocumentRequestReceived, onError]);

  /**
   * Starts the proximity flow and stops it on unmount.
   */
  useEffect(() => {
    startFlow();

    return () => {
      closeFlow();
    };
  }, [closeFlow, startFlow]);

  return (
    <SafeAreaView style={styles.container}>
      {status === PROXIMITY_STATUS.STARTING && (
        <Text style={styles.buttonText}>Starting the proximity flow</Text>
      )}
      {status === PROXIMITY_STATUS.STARTED && qrCode && (
        <QRCode value={qrCode} size={200} />
      )}
      {status === PROXIMITY_STATUS.PRESENTING && request && (
        <>
          <Button title="Send document" onPress={() => sendDocument(request)} />
          <Button
            title={`Send error ${Proximity.ErrorCode.CBOR_DECODING} (${Proximity.ErrorCode[Proximity.ErrorCode.CBOR_DECODING]})`}
            onPress={() => sendError(Proximity.ErrorCode.CBOR_DECODING)}
          />
          <Button
            title={`Send error ${Proximity.ErrorCode.SESSION_ENCRYPTION} (${Proximity.ErrorCode[Proximity.ErrorCode.SESSION_ENCRYPTION]})`}
            onPress={() => sendError(Proximity.ErrorCode.SESSION_ENCRYPTION)}
          />
          <Button
            title={`Send error ${Proximity.ErrorCode.SESSION_TERMINATED} (${Proximity.ErrorCode[Proximity.ErrorCode.SESSION_TERMINATED]})`}
            onPress={() => sendError(Proximity.ErrorCode.SESSION_TERMINATED)}
          />
        </>
      )}
      {status === PROXIMITY_STATUS.STOPPED && (
        <Button title={'Generate QR Engagement'} onPress={() => startFlow()} />
      )}
      {(status === PROXIMITY_STATUS.PRESENTING ||
        status === PROXIMITY_STATUS.STARTED) && (
        <Button
          title={'Close QR Engagement'}
          onPress={() =>
            closeFlow(status === PROXIMITY_STATUS.PRESENTING ? true : false)
          }
        />
      )}
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
