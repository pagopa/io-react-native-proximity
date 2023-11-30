import { decode, encode } from '.';
import type { JWK } from '../utils/jwk';
import cosekey from 'parse-cosekey';

export const fromJwkToCoseHex = (jwk: JWK) => {
  const key = cosekey.KeyParser.jwk2cose(jwk);
  return Buffer.from(encode(key)).toString('hex');
};

export const fromCoseToJwk = (buffer: Buffer): JWK => {
  const keyBuffer = decode(buffer);
  const parsedJwk = cosekey.KeyParser.cose2jwk(keyBuffer);
  let finalJwk: JWK;

  // the library does not return a hexadecimal string but a buffer
  if (parsedJwk.kty && parsedJwk.crv && parsedJwk.x && parsedJwk.y) {
    finalJwk = {
      kty: parsedJwk.kty,
      crv: parsedJwk.crv,
      x: Buffer.from(parsedJwk.x).toString('hex'),
      y: Buffer.from(parsedJwk.y).toString('hex'),
    };

    if (parsedJwk.d) {
      finalJwk.d = Buffer.from(parsedJwk.d).toString('hex');
    }
    if (parsedJwk.n) {
      finalJwk.n = Buffer.from(parsedJwk.n).toString('hex');
    }
    if (parsedJwk.e) {
      finalJwk.e = Buffer.from(parsedJwk.e).toString('hex');
    }

    return finalJwk;
  } else {
    throw new Error('Unable to convert key from COSE to JWK');
  }
};
