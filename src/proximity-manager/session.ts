import { CborDataItem, encode } from '../cbor';
import { fromCoseToJwk } from '../cbor/jwk';
import { rawToJwkEc, type JWK, jwkToPublicRaw } from '../utils/jwk';
import * as hkdf from 'js-crypto-hkdf';
import * as crypto from 'crypto';

const HASH = 'SHA-256';
const DERIVED_KEY_LENGTH = 32; // derived key length
const SESSION_INFO = 'SKReader'; // information specified in rfc5869

/*
 * Represents a session for exchanging information between an mDoc and an mDoc reader
 */
const Session = () => {
  let isStarted = false; // Indicates if the session has been started or not
  let eDeviceKey: JWK; // The session's public key in JWK format
  let eReaderKey: JWK; // The reader public key in JWK format
  let sessionKeys: crypto.ECDH;
  let secretSessionKey: Buffer;
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
        eDeviceKey = rawToJwkEc(sessionKeys.getPublicKey('hex'));
        isStarted = true;
        resolve('START');
      } else {
        reject(new Error('Session already started'));
      }
    });
  };

  const sessionIsStarted = () =>
    new Promise<void>((resolve, reject) => {
      if (isStarted) {
        resolve();
      } else {
        reject(new Error('Session not started'));
      }
    });

  /*
   * Returns the device public key in JWK format
   */
  const getDevicePublicKey = () => {
    return sessionIsStarted().then(() => {
      return new Promise<JWK>((resolve) => {
        return resolve(eDeviceKey);
      });
    });
  };

  /*
   * Returns the reader public key in JWK format
   */
  const getReaderPublicKey = () => {
    return sessionIsStarted().then(() => {
      return new Promise<JWK>((resolve, reject) => {
        if (eReaderKey) {
          return resolve(eDeviceKey);
        } else {
          return reject(new Error('Reader public key not set'));
        }
      });
    });
  };

  const startSessionEstablishment = (
    eReaderKeyBytes: any,
    encryptedDataBuffer: Buffer,
    deviceEngagementBuffer: Buffer
  ) => {
    return sessionIsStarted().then(() => {
      return new Promise<void>(async (resolve, reject) => {
        eReaderKey = fromCoseToJwk(
          Buffer.from(eReaderKeyBytes.cborDataItem, 'hex')
        );

        //Convert JWK to raw format compatible with crypto.ECDH
        const eReaderKeyRaw = jwkToPublicRaw(eReaderKey);

        // compute session secret
        const secret = sessionKeys.computeSecret(eReaderKeyRaw);
        const masterSecret = new Uint8Array(secret);

        const cipherData = encryptedDataBuffer.subarray(
          0,
          encryptedDataBuffer.byteLength - 16
        );

        //auth tag is the last 16 bytes of received data from mDoc Reader
        const authTag = encryptedDataBuffer.subarray(
          encryptedDataBuffer.byteLength - 16,
          encryptedDataBuffer.byteLength
        );

        const deviceEngagementBytes = new CborDataItem(
          deviceEngagementBuffer.toString('hex')
        );

        const sessionTranscript = [
          deviceEngagementBytes,
          eReaderKeyBytes,
          null,
        ];

        const sessionTranscriptBytes = encode(sessionTranscript);
        const sessionTranscriptCbor = Buffer.from(
          encode(new CborDataItem(sessionTranscriptBytes.toString('hex')))
        );

        const saltSha = crypto
          .createHash('sha256')
          .update(sessionTranscriptCbor)
          .digest();
        const salt = new Uint8Array(saltSha); // Uint8Array of arbitrary length

        //Compute session key with HMAC-based Extract-and-Expand Key Derivation Function
        await hkdf
          .compute(masterSecret, HASH, DERIVED_KEY_LENGTH, SESSION_INFO, salt)
          .then((derivedKey) => {
            // now you get a key derived from the masterSecret
            secretSessionKey = Buffer.from(derivedKey.key);

            console.debug(
              'secretSessionKey: ',
              secretSessionKey.toString('hex')
            );
            console.debug(
              'cipherData: ',
              Buffer.from(cipherData).toString('hex')
            );
            console.debug('authTag: ', Buffer.from(authTag).toString('hex'));

            //TODO: with these parameters it is now possible to decrypt the data content using AES256 Galois/Counter Mode
            resolve();
          })
          .catch((e) => {
            reject(
              new Error(
                `Unable to compute session key with HMAC-based Extract-and-Expand Key Derivation Function\n Error: ${e}`
              )
            );
          });
      });
    });
  };

  /*
   * Closes the session. Returns an exception if the session is not started
   */
  const close = () => {
    return sessionIsStarted().then(() => {
      isStarted = false;
      return Promise.resolve();
    });
  };

  return {
    start,
    close,
    isStarted,
    getDevicePublicKey,
    getReaderPublicKey,
    startSessionEstablishment,
  };
};

export default Session();
