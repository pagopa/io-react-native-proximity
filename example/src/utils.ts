import {
  deleteKey,
  generate,
  type CryptoError,
} from '@pagopa/io-react-native-crypto';
import { Platform } from 'react-native';
import {
  checkMultiple,
  type Permission,
  PERMISSIONS,
  requestMultiple,
  RESULTS,
} from 'react-native-permissions';
import { WELL_KNOWN_CREDENTIALS } from './mocks';
import type { VerifierRequest } from '../../src/schema';

/**
 * This function generates the accepted fields for the VerifierRequest and sets each requested field to true.
 * @param request - The request object containing the requested fields
 * @returns A new object with the same structure as the request, but with all values set to true
 */
export const generateAcceptedFields = (
  request: VerifierRequest['request']
): VerifierRequest['request'] => {
  const result: VerifierRequest['request'] = {};
  for (const key1 in request) {
    result[key1] = {};
    for (const key2 in request[key1]) {
      result[key1][key2] = {};
      for (const key3 in request[key1][key2]) {
        result[key1][key2][key3] = true;
      }
    }
  }
  return result;
};

/**
 * Generates a key pair if it does not exist
 * @param keyTag The key tag to use
 */
export const generateKeyIfNotExists = async (keyTag: string) => {
  await deleteKey(keyTag).catch((e) => {
    const { message } = e as CryptoError;
    if (message !== 'PUBLIC_KEY_NOT_FOUND') throw e;
  });
  await generate(keyTag);
};

/**
 * Utility funciton to check if the request only contains the mDL credential type.
 * @param requestKeys - The keys of the request object which contains the credential type
 * @returns void if the request is valid, otherwise throws an error
 * @throws Error if the request contains multiple keys or if the key is not the mDL credential type
 */
export const isRequestMdl = (requestKeys: Array<string>) => {
  if (requestKeys.length !== 1) {
    throw new Error('Unexpected request keys. Expected only one key.');
  }
  if (requestKeys[0] !== WELL_KNOWN_CREDENTIALS.mdl) {
    throw new Error('Unexpected request key. Expected only mDL.');
  }
  return;
};

/**
 * Utility function to request Bluetooth permissions for both iOS and Android via react-native-permissions.
 */
export const requestBlePermissions = async (): Promise<boolean> => {
  let permissionsToCheck: Permission[];

  if (Platform.OS === 'android') {
    if (Platform.Version >= 31) {
      // Android 12 and above: Request new Bluetooth permissions along with location.
      permissionsToCheck = [
        PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
        PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
        PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        PERMISSIONS.ANDROID.BLUETOOTH_ADVERTISE,
      ];
    } else {
      // Android 9 to Android 11: Only location permission is required for BLE.
      permissionsToCheck = [PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION];
    }
  } else {
    // iOS permissions required are Bluetooth and location.
    permissionsToCheck = [
      PERMISSIONS.IOS.BLUETOOTH,
      PERMISSIONS.IOS.LOCATION_ALWAYS,
    ];
  }

  try {
    // Check current permission status
    const statuses = await checkMultiple(permissionsToCheck);

    // Filter out already granted permissions
    const permissionsToRequest = permissionsToCheck.filter(
      (permission) => statuses[permission] !== RESULTS.GRANTED
    );

    if (permissionsToRequest.length > 0) {
      // Request only the missing permissions
      const requestResults = await requestMultiple(permissionsToRequest);

      // Verify if all requested permissions are granted
      return permissionsToRequest.every(
        (permission) => requestResults[permission] === RESULTS.GRANTED
      );
    }

    return true; // All permissions were already granted
  } catch (error) {
    console.error('Permission request error:', error);
    return false;
  }
};
