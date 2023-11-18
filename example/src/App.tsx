import * as React from 'react';
import { ProximityManager } from '@pagopa/io-react-native-proximity';
import {
  StyleSheet,
  View,
  Button,
  Image,
  Platform,
  PermissionsAndroid,
  Text,
} from 'react-native';
import RNQRGenerator from 'rn-qr-generator';
import { type EventData } from '@pagopa/io-react-native-proximity';

export default function App() {
  const [qrCodeUri, setQrCodeUri] = React.useState<string | undefined>();
  const [isStarted, setIsStarted] = React.useState<boolean>(false);
  const [debug, setDebug] = React.useState<string>('log here');

  React.useEffect(() => {
    handleAndroidPermissions();
  }, []);

  const onEvent = (event: EventData) => {
    console.log('onEvent', event);
    switch (event.type) {
      case 'ON_BLE_START':
        setIsStarted(true);
        break;
      case 'ON_BLE_STOP':
        setIsStarted(false);
        break;
      default:
        break;
    }
  };

  const onSuccess = (event: EventData) => {
    console.log('onSuccess', event);
  };

  const onError = (event: EventData) => {
    console.log('onError', event);
  };

  const startProximityManager = () => {
    console.log('startProximityManager');
    ProximityManager.start()
      .then(() => {
        console.log('ProximityManager started');
      })
      .catch((error) => {
        console.log(error);
      });
    ProximityManager.setListeners({
      onEvent,
      onSuccess,
      onError,
    });
  };

  const stopProximityManager = () => {
    console.log('stopProximityManager');
    ProximityManager.stop().then(() => {
      setQrCodeUri(undefined);
      setIsStarted(false);
    });
  };

  const generateQrCode = async () => {
    const qrcode = await ProximityManager.generateQrCode();
    RNQRGenerator.generate({
      value: qrcode,
      height: 300,
      width: 300,
      correctionLevel: 'H',
    })
      .then((response) => {
        setQrCodeUri(response.uri);
      })
      .catch((error) => {
        console.log(error);
      });
  };

  const handleAndroidPermissions = () => {
    if (
      Platform.OS === 'android' &&
      Platform.Version >= 31 &&
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN &&
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
    ) {
      PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]).then((result) => {
        if (result) {
          console.debug(
            '[handleAndroidPermissions] User accepts runtime permissions android 12+'
          );
        } else {
          console.error(
            '[handleAndroidPermissions] User refuses runtime permissions android 12+'
          );
        }
      });
    } else if (
      Platform.OS === 'android' &&
      Platform.Version >= 23 &&
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    ) {
      PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      ).then((checkResult) => {
        if (checkResult) {
          console.debug(
            '[handleAndroidPermissions] runtime permission Android <12 already OK'
          );
        } else {
          if (PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION) {
            PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
            ).then((requestResult) => {
              if (requestResult) {
                console.debug(
                  '[handleAndroidPermissions] User accepts runtime permission android <12'
                );
              } else {
                console.error(
                  '[handleAndroidPermissions] User refuses runtime permission android <12'
                );
              }
            });
          }
        }
      });
    }
  };

  return (
    <View style={styles.container}>
      {(isStarted && (
        <>
          <Button title="Generate QR 🏞️" onPress={() => generateQrCode()} />
          <Button title="Stop 🛑" onPress={() => stopProximityManager()} />
          {qrCodeUri && (
            <Image
              style={styles.box}
              source={{
                uri: qrCodeUri,
              }}
            />
          )}
        </>
      )) || (
        <>
          <Button title="Start 🏁" onPress={() => startProximityManager()} />
          <Button
            title="Test crypto 🔐"
            onPress={() => ProximityManager.testCrypto().then(setDebug)}
          />
        </>
      )}

      <Text style={styles.debug}>{debug}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    width: 200,
    height: 200,
    marginVertical: 20,
  },
  debug: {
    width: '100%',
    height: 100,
    position: 'absolute',
    bottom: 0,
    backgroundColor: '#eaeaea',
  },
});
