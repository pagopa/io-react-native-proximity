import { encode } from '.';
import type { JWK } from '../utils/jwk';
import cosekey from 'parse-cosekey';

export const fromJwkToCoseHex = (jwk: JWK) => {
  const key = cosekey.KeyParser.jwk2cose(jwk);
  return Buffer.from(encode(key)).toString('hex');
};
