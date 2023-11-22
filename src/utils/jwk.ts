import { removePadding } from '@pagopa/io-react-native-jwt';

export type JWK = {
  kty: string;
  crv: string;
  x: string;
  y: string;
  d?: string;
};

//Convert EC key pair from raw to JWK format
export const rawToJwkEc = (pubHex: string, prvHex?: string): JWK => {
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: removePadding(
      Buffer.from(Buffer.from(pubHex, 'hex').subarray(1, 33)).toString('base64')
    ),
    y: removePadding(
      Buffer.from(Buffer.from(pubHex, 'hex').subarray(33, 66)).toString(
        'base64'
      )
    ),
  };
  if (prvHex) {
    return {
      ...jwk,
      d: removePadding(Buffer.from(prvHex, 'hex').toString('base64')),
    };
  }
  return jwk;
};
