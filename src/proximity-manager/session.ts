import { rawToJwkEc, type JWK } from '../utils/jwk';

import * as crypto from 'crypto';

/*
 * Represents a session for exchanging information between an mDoc and an mDoc reader
 */
const Session = () => {
  let isStarted = false; // Indicates if the session has been started or not
  let sessionPublicJwk: JWK; // The session's public key in JWK format
  let sessionKeys: crypto.ECDH;

  /*
   * Starts the session. Returns an exception if the session has already been started
   */
  const start = () => {
    return new Promise<string>(async (resolve, reject) => {
      if (!isStarted) {
        // Generates an ephemeral key pair of elliptic type (secp256)
        sessionKeys = crypto.createECDH('secp256r1');
        sessionKeys.generateKeys();

        // Converts the public key into JWK format
        sessionPublicJwk = rawToJwkEc(sessionKeys.getPublicKey('hex'));
        isStarted = true;
        resolve('START');
      } else {
        reject(new Error('Session already started'));
      }
    });
  };

  /*
   * Returns the session public key in JWK format
   */
  const getSessionPublicKey = () => {
    return new Promise<JWK>((resolve, reject) => {
      if (isStarted) {
        resolve(sessionPublicJwk);
      } else {
        reject(new Error('Session not started'));
      }
    });
  };

  /*
   * Closes the session. Returns an exception if the session is not started
   */
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
