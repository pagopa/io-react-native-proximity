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
import type { AcceptedFields, VerifierRequest } from '../../src/schema';

/**
 * This function generates the accepted fields for the VerifierRequest and sets each requested field to true.
 * @param request - The request object containing the requested fields
 * @returns A new object with the same structure as the request, but with all values set to true
 */
export const generateAcceptedFields = (
  _: VerifierRequest['request']
): AcceptedFields => {
  //TODO implement a more generic solution to generate the accepted fields
  const acceptedFields: AcceptedFields = {
    'org.iso.18013.5.1.mDL': {
      'org.iso.18013.5.1': {
        height: true,
        weight: true,
        portrait: true,
        birth_date: true,
        eye_colour: true,
        given_name: true,
        issue_date: true,
        age_over_18: true,
        age_over_21: true,
        birth_place: true,
        expiry_date: true,
        family_name: true,
        hair_colour: true,
        nationality: true,
        age_in_years: true,
        resident_city: true,
        age_birth_year: true,
        resident_state: true,
        document_number: true,
        issuing_country: true,
        resident_address: true,
        resident_country: true,
        issuing_authority: true,
        driving_privileges: true,
        issuing_jurisdiction: true,
        resident_postal_code: true,
        signature_usual_mark: true,
        administrative_number: true,
        portrait_capture_date: true,
        un_distinguishing_sign: true,
        given_name_national_character: true,
        family_name_national_character: true,
      },
    },
  };

  return acceptedFields;
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
