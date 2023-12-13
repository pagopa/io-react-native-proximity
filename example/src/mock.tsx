/*
 * This is a mock of the mDL credential which already contains the device authentication inside.
 * In the real case, the device authentication will be calculated by the ProximityManager by passing the key tag (public key)
 * associated with the mDL credential.
 */
export const mockedmDL = Buffer.from('', 'hex');
