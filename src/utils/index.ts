import uuid from 'react-native-uuid';

export const uuidToBuffer = (uuidString: string) =>
  Buffer.from(uuid.parse(uuidString));
