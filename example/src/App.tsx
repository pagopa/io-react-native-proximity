import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { QrCodeScreen } from './screens/QrCodeScreen';
import { QrScannerScreen } from './screens/QrScannerScreen';
import { NavigationContainer } from '@react-navigation/native';

const Tab = createBottomTabNavigator();

const App = () => {
  return (
    <NavigationContainer>
      <Tab.Navigator
        initialRouteName={'QrCodeScreen'}
        screenOptions={{
          lazy: true,
        }}
      >
        <Tab.Screen name="QrCodeScreen" component={QrCodeScreen} />
        <Tab.Screen name="QrScannerScreen" component={QrScannerScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

export default App;
