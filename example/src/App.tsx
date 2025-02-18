import { Button, Text, View } from 'react-native';
import ProximityModule from '../../src/proximity';

const App = () => {
  const startSlave = async () => {
    const initialized = await ProximityModule.initializeQrEngagement(
      true,
      false,
      false
    );

    if (initialized) {
      const qrCode = await ProximityModule.getQrCodeString();
      console.log(qrCode);
    }
  };
  return (
    <View style={{ padding: 20, alignItems: 'center' }}>
      <Text style={{ fontSize: 18, marginBottom: 10 }}>Proximity Example</Text>
      <Button title="Start Slave (Generate QR)" onPress={startSlave} />
      <Button
        title="Start Master (Scan & Extract QR)"
        onPress={() => console.log('test')}
      />
    </View>
  );
};

export default App;
