import { QrCodeScreen } from './screens/QrCodeScreen';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const Stack = createNativeStackNavigator();

const App = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="QrCodeScreen" component={QrCodeScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;
