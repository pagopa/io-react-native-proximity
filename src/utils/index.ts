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

/*
 * Split a buffer in an array of buffer chunks of given size
 */
export const splitBufferInChunks = (buffer: Buffer, chunkSize: number) => {
  if (chunkSize <= 0) {
    throw new Error('Chunk size should be positive number greather than 0.');
  }

  let result = [];
  let len = buffer.length;
  let i = 0;

  while (i < len) {
    result.push(buffer.subarray(i, (i += chunkSize)));
  }

  return result;
};

//Sleep in milliseconds
export const sleepMs = (ms: number) => new Promise((r) => setTimeout(r, ms));
