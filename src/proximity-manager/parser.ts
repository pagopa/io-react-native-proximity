import { decode } from '../cbor';
import { z } from 'zod';

export const NameSpaces = z
  .object({
    birth_date: z.boolean().optional(),
    birth_place: z.boolean().optional(),
    family_name: z.boolean().optional(),
    given_name: z.boolean().optional(),
  })
  .passthrough();
export type NameSpaces = z.infer<typeof NameSpaces>;

export const DocumentRequest = z
  .object({
    docType: z.string(),
    nameSpaces: NameSpaces,
  })
  .passthrough();
export type DocumentRequest = z.infer<typeof DocumentRequest>;

export const documentsRequestParser = (
  sessionEstablishmentCborEncodedData: Buffer
): DocumentRequest[] => {
  const sessionEstablishmentData = decode(sessionEstablishmentCborEncodedData);
  const version = sessionEstablishmentData.get('version');
  if (version === '1.0') {
    const docRequests = sessionEstablishmentData.get('docRequests');

    const parsedDocRequests = docRequests.map(
      (encodedDocRequest: Map<string, any>) => {
        const itemRequest = encodedDocRequest.get('itemsRequest');
        const cborData = itemRequest.cborDataItem;
        const docRequest = documentRequestParser(Buffer.from(cborData, 'hex'));
        return docRequest;
      }
    );
    return parsedDocRequests;
  } else {
    throw new Error('Invalid version');
  }
};

const documentRequestParser = (docRequestBuffer: Buffer): DocumentRequest => {
  const decoded = decode(docRequestBuffer);
  const docType = decoded.get('docType');
  const nameSpacesMap = decoded.get('nameSpaces').get('org.iso.18013.5.1');

  const nameSpaces = NameSpaces.parse(Object.fromEntries(nameSpacesMap));

  return {
    docType,
    nameSpaces,
  };
};
