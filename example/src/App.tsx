import { Button, Image, Text, View } from 'react-native';
import ProximityModule from '../../src/proximity';
import { useState } from 'react';
import RNQRGenerator from 'rn-qr-generator';

const App = () => {
  const [qrCode, setQrCode] = useState<string>();
  const [qrCodeImgUri, setQrCodeImgUri] = useState<string>();

  const startSlave = async () => {
    const initialized = await ProximityModule.initializeQrEngagement(
      true,
      false,
      false
    );

    if (initialized) {
      const qrCodeString = await ProximityModule.getQrCodeString();
      setQrCode(qrCodeString);
      RNQRGenerator.generate({
        value: qrCodeString,
        height: 200,
        width: 200,
        correctionLevel: 'H',
      })
        .then((response) => {
          const { uri } = response;
          setQrCodeImgUri(uri);
        })
        .catch((error) => console.log('Cannot create QR code', error));
    }
  };
  return (
    <View
      style={{
        flex: 1,
        padding: 20,
        alignItems: 'center',
        backgroundColor: '#fff',
      }}
    >
      <Text style={{ fontSize: 18, marginBottom: 10 }}>Proximity Example</Text>
      <Button title="Start Slave (Generate QR)" onPress={startSlave} />
      {qrCodeImgUri && (
        <Image
          source={{ uri: qrCodeImgUri }}
          style={{ width: 200, height: 200 }}
        />
      )}
      {qrCode && <Text style={{ margin: 10 }}>{qrCode}</Text>}
      <Button
        title="Start Master (Scan & Extract QR)"
        onPress={() => console.log('test')}
      />
    </View>
  );
};

export default App;
