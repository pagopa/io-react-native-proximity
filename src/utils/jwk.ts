import { removePadding } from '@pagopa/io-react-native-jwt';

export type JWK = {
  kty: string;
  crv: string;
  x: string;
  y: string;
  d?: string;
  n?: string;
  e?: string;
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

/*
 * In a raw uncompressed public key, the first byte 0x04
 * indicates uncompressed form and X is first half and Y is the second half.
 * https://davidederosa.com/basic-blockchain-programming/elliptic-curve-keys/
 */
export const jwkToPublicRaw = (publicKey: JWK) => {
  const x = Buffer.from(publicKey.x, 'hex');
  const y = Buffer.from(publicKey.y, 'hex');

  var arr = [Buffer.from('04', 'hex'), x, y];
  return Buffer.concat(arr);
};
