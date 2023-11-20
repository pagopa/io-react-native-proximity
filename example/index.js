require('@pagopa/react-native-nodelibs/globals');
import 'text-encoding-polyfill';

import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
