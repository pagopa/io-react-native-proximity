import { rawToJwkEc, type JWK } from '../utils/jwk';

import * as crypto from 'crypto';

const Session = () => {
  let isStarted = false;
  let sessionPublicJwk: JWK;

  const start = () => {
    return new Promise<string>(async (resolve, reject) => {
      if (!isStarted) {
        let sessionKeys = crypto.createECDH('secp256r1');
        sessionKeys.generateKeys();

        sessionPublicJwk = rawToJwkEc(sessionKeys.getPublicKey('hex'));
        isStarted = true;
        resolve('START');
      } else {
        reject(new Error('Session already started'));
      }
    });
  };

  const getSessionPublicKey = () => {
    return new Promise<JWK>((resolve, reject) => {
      if (isStarted) {
        resolve(sessionPublicJwk);
      } else {
        reject(new Error('Session not started'));
      }
    });
  };

  const close = () => {
    return new Promise<string>((resolve, reject) => {
      if (isStarted) {
        isStarted = false;
        resolve('STOPPED');
      } else {
        reject(new Error('Session not started'));
      }
    });
  };

  return {
    start,
    close,
    isStarted,
    getSessionPublicKey,
  };
};

export default Session();
