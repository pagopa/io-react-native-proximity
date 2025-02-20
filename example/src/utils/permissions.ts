import { Platform } from 'react-native';
import {
  checkMultiple,
  PERMISSIONS,
  requestMultiple,
  RESULTS,
} from 'react-native-permissions';

export const requestBlePermissions = async (): Promise<boolean> => {
  const AndroidPermissions = [
    PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
    PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
    PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
    PERMISSIONS.ANDROID.BLUETOOTH_ADVERTISE,
  ];

  const iOSPermissions = [
    PERMISSIONS.IOS.BLUETOOTH,
    PERMISSIONS.IOS.LOCATION_ALWAYS,
  ];

  const permissionsToCheck =
    Platform.OS === 'android' ? AndroidPermissions : iOSPermissions;

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
