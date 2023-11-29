import { CborDataItem, encode } from '../cbor';
import { fromCoseToJwk } from '../cbor/jwk';
import { rawToJwkEc, type JWK, jwkToPublicRaw } from '../utils/jwk';
import * as hkdf from 'js-crypto-hkdf';
import * as crypto from 'crypto';
import { intTo4Bytes } from '../utils';
import { DocumentRequest, sessionEstablishmentParser } from './parser';

const HASH = 'SHA-256';
const DERIVED_KEY_LENGTH = 32; // derived key length
const SESSION_INFO = 'SKReader'; // information specified in rfc5869

const READER_IDENTIFIER = [0, 0, 0, 0, 0, 0, 0, 0];

/*
 * Represents a session for exchanging information between an mDoc and an mDoc reader
 */
const Session = () => {
  let isStarted = false; // Indicates if the session has been started or not
  let eDeviceKey: JWK; // The session's public key in JWK format
  let eReaderKey: JWK; // The reader public key in JWK format
  let sessionKeys: crypto.ECDH;
  let secretSessionKey: Buffer;

  let readerMessageCounter = 1;

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

        readerMessageCounter = 1;
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
      return new Promise<DocumentRequest[]>(async (resolve, reject) => {
        eReaderKey = fromCoseToJwk(
          Buffer.from(eReaderKeyBytes.cborDataItem, 'hex')
        );

        //Convert JWK to raw format compatible with crypto.ECDH
        const eReaderKeyRaw = jwkToPublicRaw(eReaderKey);

        // compute session secret
        const secret = sessionKeys.computeSecret(eReaderKeyRaw);
        const masterSecret = new Uint8Array(secret);

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
          .then(async (derivedKey) => {
            // now you get a key derived from the masterSecret
            secretSessionKey = Buffer.from(derivedKey.key);

            console.debug(
              'secretSessionKey: ',
              secretSessionKey.toString('hex')
            );

            const sessionEstablishmentCborEncodedData =
              await decryptReaderMessage(encryptedDataBuffer);

            const documentRequests = sessionEstablishmentParser(
              sessionEstablishmentCborEncodedData
            );

            resolve(documentRequests);
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

  const decryptReaderMessage = (encryptedDataBuffer: Buffer) =>
    sessionIsStarted().then(
      () =>
        new Promise<Buffer>(async (resolve, reject) => {
          if (secretSessionKey) {
            const cipherData = encryptedDataBuffer.subarray(
              0,
              encryptedDataBuffer.byteLength - 16
            );

            //auth tag is the last 16 bytes of received data from mDoc Reader
            const authTag = encryptedDataBuffer.subarray(
              encryptedDataBuffer.byteLength - 16,
              encryptedDataBuffer.byteLength
            );

            const readerIdentifier = Buffer.from(READER_IDENTIFIER);
            const readerMessageCounterHex = intTo4Bytes(readerMessageCounter);

            // IV is the concatenation of IDENTIFIER and message counter
            const iv = Buffer.concat([
              readerIdentifier,
              readerMessageCounterHex,
            ]);

            const decipher = crypto.createDecipheriv(
              'aes-256-gcm',
              secretSessionKey,
              iv,
              {
                authTagLength: 16,
              }
            );

            // AAD need to be an empty string
            decipher.setAAD(Buffer.from('', 'utf-8'));
            decipher.setAuthTag(authTag);

            const result_update = decipher.update(Buffer.from(cipherData));
            const result_final = decipher.final();

            const plaintext = Buffer.concat([result_update, result_final]);

            readerMessageCounter++;

            resolve(plaintext);
          } else {
            reject(
              new Error('Session not established. Invalid secret session key.')
            );
          }
        })
    );
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
