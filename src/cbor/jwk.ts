import { decode, encode } from '.';
import type { JWK } from '../utils/jwk';

export const fromJwkToCoseHex = (jwk: JWK) => {
  console.log('fromJwkToCoseHex', fromJwkToCoseHex);
  if (jwk.kty === 'EC') {
    const key = new Map();
    key.set(1, 2); //KID
    key.set(-1, 1); //Type (1 = EC P-256 / secp256r1)
    key.set(-2, Buffer.from(jwk.x, 'base64')); // X
    key.set(-3, Buffer.from(jwk.y, 'base64')); // y
    return Buffer.from(encode(key)).toString('hex');
  } else {
    throw new Error('Not implemented');
  }
};

export const fromCoseToJwk = (buffer: Buffer): JWK => {
  const keyBuffer = decode(buffer);
  const kid = keyBuffer.get(1);
  const typ = keyBuffer.get(-1);
  const x = Buffer.from(keyBuffer.get(-2));
  const y = Buffer.from(keyBuffer.get(-3));

  if (kid === 2 && typ === 1) {
    let finalJwk: JWK = {
      kty: 'EC',
      crv: 'P-256',
      x: x.toString('hex'),
      y: y.toString('hex'),
    };
    console.log('finalJwk', finalJwk);
    return finalJwk;
  } else {
    throw new Error('Not implemented');
  }
};
