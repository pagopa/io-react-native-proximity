import { Encoder, addExtension } from 'cbor-x';

export class CborDataItem {
  cborDataItem: string;
  constructor(hex: string) {
    this.cborDataItem = hex;
  }
}

const encoder = new Encoder({
  tagUint8Array: false, //Avoid to use tag 64 for Uint8Array
});

//Add support for tag 24 (CBOR data item RFC8949)
addExtension({
  Class: CborDataItem,
  tag: 24,
  encode: (obj, enc) => {
    const buffer = Buffer.from(obj.cborDataItem, 'hex');
    return enc(buffer);
  },
  decode: (data) => {
    return new CborDataItem(Buffer.from(data as Uint8Array).toString('hex'));
  },
});

export const encode = (value: any): Buffer => {
  return Buffer.from(encoder.encode(value));
};

export const decode = (value: Buffer): any => {
  return encoder.decode(value);
};
