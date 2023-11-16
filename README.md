# @pagopa/io-react-native-proximity

📲 Digital Identity Wallet Proximity Feature

### Dependencies

This package is base on [react-native-ble-manager](https://github.com/innoveit/react-native-ble-manager)

## Installation

```sh
yarn add @pagopa/io-react-native-proximity
```

## Usage

Refer to Example App for actual usages.

### Proximity Manager

To initiate the Proximity Manager:

```typescript
import { ProximityManager } from '@pagopa/io-react-native-proximity';

// ...

ProximityManager.start()
  .then(() => {
    console.log('ProximityManager started');
  })
  .catch((error) => {
    console.log(error);
  });
```

Set event listeners for the Proximity Manager:

```typescript
import { ProximityManager } from '@pagopa/io-react-native-proximity';

// ...

ProximityManager.setListeners({
  onEvent,
  onSuccess,
  onError,
});
```

### React Native

Follow the [official tutorial](https://reactnative.dev/docs/environment-setup?guide=native) for installing the `React Native CLI` for your operating system.

If you have a macOS system, you can follow both the tutorial for iOS and for Android. If you have a Linux or Windows system, you only need to install the development environment for Android.

### Build the app

In order to build the app,
As stated [previously](#nodejs-and-ruby), we also use `nodenv` and `rbenv` for managing the environment:

```bash
# Clone the repository
$ git clone https://github.com/pagopa/io-react-native-proximity

# CD into the repository
$ cd io-react-native-proximity

# Install library dependencies
$ yarn install

# CD into the example folder
$ cd example

# Install bundle
$ gem install bundle

# Install the required Gems from the Gemfile
# Run this only during the first setup and when Gems dependencies change
$ bundle install

# Install example dependencies
# Run this only during the first setup and when JS dependencies change
$ yarn install

# Install podfiles when targeting iOS (ignore this step for Android)
# Run this only during the first setup and when Pods dependencies change
$ cd ios && bundle exec pod install && cd ..

# Run the app on iOS
$ yarn ios

# Run the app on Android
$ yarn android
```
