import uuid from 'react-native-uuid';

export const uuidToBuffer = (uuidString: string) =>
  Buffer.from(uuid.parse(uuidString));

/*
 * Converts an integer to a 4-byte representation.
 * For example the number 1 is converted to 0x00, 0x00, 0x00, 0x01
 */
export const intTo4Bytes = (num: number) => {
  const arr = new Uint8Array([
    // eslint-disable-next-line no-bitwise
    (num & 0xff000000) >> 24,
    // eslint-disable-next-line no-bitwise
    (num & 0x00ff0000) >> 16,
    // eslint-disable-next-line no-bitwise
    (num & 0x0000ff00) >> 8,
    // eslint-disable-next-line no-bitwise
    num & 0x000000ff,
  ]);
  return Buffer.from(arr);
};
