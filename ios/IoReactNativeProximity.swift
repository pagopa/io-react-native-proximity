import Foundation
import IOWalletProximity
import React

@objc(IoReactNativeProximity)
class IoReactNativeProximity: RCTEventEmitter {
  
  private typealias ME = ModuleException
  
  @objc
  override static func requiresMainQueueSetup() -> Bool {
    return true
  }
  
  override init() {
    super.init()
    setupProximityHandler()
  }
  
  override func supportedEvents() -> [String]! {
    return ["onConnecting", "onDeviceRetrievalHelperReady", "onCommunicationError", "onNewDeviceRequest", "onDeviceDisconnected"]
  }
  
  /**
   Type alias for the accepted fields during the presentation. These are the fields which the user accepted to share.
   It can be fed to the ``IOWalletProximity.generateResponse`` function.
   An example might be:
   `["org.iso.18013.5.1.mDL": ["org.iso.18013.5.1": ["hair_colour": true, "given_name_national_character": true, "family_name_national_character": true, "given_name": true]]]`
   */
  typealias AcceptedFieldsDict = [String: [String: [String: Bool]]]
  
  /**
   Creates a QR code to be scanned in order to initialize the presentation.
   
   - Parameters:
   - resolve: The promise to be resolved
   - reject: The promise to be rejected
   
   - Returns: A new string representing the QR code
   */
  @objc(getQrCodeString:withRejecter:)
  func getQrCodeString(
    _ resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    if let qrCodeString = Proximity.shared.start() {
      resolve(qrCodeString)
    } else {
      ME.qrCodeError.reject(reject: reject, ("error", "Error generating QR code"))
    }
  }
  
  /**
   Parses an array of documents from the React Native bridge which doesn't have any typing to an array of ``IOWalletProximity.ProximityDocument``.
   It checks if each element in the array has  `issuerSignedContent`, `alias` and `docType` properties in order to build a ``IOWalletProximity.ProximityDocument``, then it appens it to the array.
   The result can be fed to ``IOWalletProximity.generateResponse``.
   
   - Parameters:
   - documents: An array of any elements. In order to be added to the result array each element must be a dictionary with `issuerSignedContent`, `alias` and `docType` as keys and strings as values.
   - resolve: The promise to be resolved
   - reject: The promise to be rejected
   
   - Throws: `NSError`if result array is empty
   
   - Returns: A new string representing the QR code
   */
  private func parseDocuments(documents: Array<Any>) throws  -> [ProximityDocument] {
    var parsedDocuments: [ProximityDocument] = []
    for doc in documents {
      if let dict = doc as? [String: Any] {
        if let issuerSignedContent = dict["issuerSignedContent"] as? String,
           let alias = dict["alias"] as? String,
           let docType = dict["docType"] as? String, let decodedIssuerSignedContent = Data(base64Encoded: issuerSignedContent) {
          if let document = ProximityDocument(docType: docType, issuerSigned: [UInt8](decodedIssuerSignedContent), deviceKeyTag: alias) {
            parsedDocuments.append(document)
          }
        }
      }
    }
    
    if(parsedDocuments.isEmpty){
      throw NSError(domain: "ParseDocument", code: -1, userInfo: [NSLocalizedDescriptionKey: "Error parsing documents"])
    }
    
    return parsedDocuments
  }
  
  /**
   Parses a dictionary of accepted fields for the presentation from the React Native bridge which doesn't have any typing to a ``AcceptedFieldsDict`` dictionary.
   It checks if each element in the array is a dictionary where the key is a string, and the value is another dictionary. This nested dictionary has a string as its key and a boolean as its value, then it appens it to the array.
   The result can be fed to ``IOWalletProximity.generateResponse``.
   
   - Parameters:
   - acceptedFields: A dictionary of any elements. In order to be added to the result dictionary each element must be shaped as ``AcceptedFieldsDict`` thus as [String: [String: [String: Bool]]]
   - resolve: The promise to be resolved
   - reject: The promise to be rejected
   
   - Throws: `NSError` if a value doesn't has the ``AcceptedFieldsDict`` shape or the result dictionary is empty
   
   - Returns: An ``AcceptedFieldsDict`` containg the accepted fields to be presented
   */
  private func parseAcceptedFields(acceptedFields: [AnyHashable: Any]) throws -> AcceptedFieldsDict {
    var result: AcceptedFieldsDict = [:]
    
    for (key, value) in acceptedFields {
      guard let keyString = key as? String else {
        throw NSError(domain: "ParseAcceptedFields", code: -1, userInfo: [NSLocalizedDescriptionKey: "Key must be a String."])
      }
      guard let valueDict = value as? [String: [String: Bool]] else {
        throw NSError(domain: "ParseAcceptedFields", code: -1, userInfo: [NSLocalizedDescriptionKey: "Value must be of type [String: [String: Bool]]."])
      }
      result[keyString] = valueDict
    }
    
    if(result.isEmpty){
      throw NSError(domain: "ParseAcceptedFields", code: -1, userInfo: [NSLocalizedDescriptionKey: "Error parsing documents"])
    }
    
    return result
  }
  
  /**
   Generates a response containing the documents and the fields which the user decided to present.
   It parses the untyped ``documents`` and ``acceptedFields`` parameters and feds them to the ``IOWalletProximity.generateDeviceResponse`` function.
   It resolves the promise with the response as a base64 encoded string.
   It rejects the promise if an error occurs during the parameters parsing or while generating the device response.
   
   - Parameters:
   - documents: An array of documents which should contain a dictionary with `issuerSignedContent`, `alias` and `docType` as keys and strings as values
   - acceptedFields: A dictionary of elements, where each element must adhere to the structure of AcceptedFieldsDict—specifically, a [String: [String: [String: Bool]]]. The outermost key represents the credentia doctypel. The inner dictionary contains namespaces, and for each namespace, there is another dictionary mapping requested claims to a boolean value, which indicates whether the user is willing to present the corresponding claim.
   …
       
           {
              "org.iso.18013.5.1.mDL": {
                "org.iso.18013.5.1": {
                  "hair_colour": true,
                  "given_name_national_character": true,
                  "family_name_national_character": true,
                  "given_name": true,
                }
              }
           }
       
   …
   - resolve: The promise to be resolved
   - reject: The promise to be rejected
   */
  @objc(generateResponse:withAcceptedFields:withResolver:withRejecter:)
  func generateResponse(
    documents: Array<Any>,
    acceptedFields: [AnyHashable: Any],
    _ resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ){
    do {
      let parsedDocuments = try parseDocuments(documents: documents)
      let items = try parseAcceptedFields(acceptedFields: acceptedFields)
      let deviceResponse = Proximity.shared.generateDeviceResponse(allowed: true, items: items, documents: parsedDocuments, sessionTranscript: nil)
      if let unwrapDeviceResponse = deviceResponse {
        let strDeviceResponse = Data(unwrapDeviceResponse).base64EncodedString()
        resolve(strDeviceResponse)
      }else{
        ME.generateDeviceResponseError.reject(reject: reject, ("error", "Error generating device response"))
      }
    }catch{
      ME.generateDeviceResponseError.reject(reject: reject, ("error", error.localizedDescription))
    }
  }
  
  /**
   Sends a response containing the documents and the fields which the user decided to present generated by ``generateResponse``.
   It resolves to true after sending the response, otherwise it rejects if an error occurs while decoding the response.
   Currently there's not evidence of the verifier app responding to this request, thus we don't handle the response.
   
   - Parameters:
     - response: A base64 encoded string containg the response generated by ``generateResponse``
     - resolve: The promise to be resolved
     - reject: The promise to be rejected
   */
  @objc(sendResponse:withResolver:withRejecter:)
  func sendResponse(
    response: String,
    _ resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ){
    if let responseData = Data(base64Encoded: response) {
      let decodedResponse = [UInt8](responseData)
      Proximity.shared.dataPresentation(allowed: true, decodedResponse)
      resolve(true)
    } else {
      ME.sendResponseError.reject(reject: reject, ("error", "An error occurred while decoding the response"))
    }
  }
  
  /**
   Sends a no data response when the user declines the presentation request.
   - Parameters:
     - resolve: The promise to be resolved
     - reject: The promise to be rejected
   */
  @objc(sendErrorResponseNoData:withRejecter:)
  func sendErrorResponseNoData(_ resolve: @escaping RCTPromiseResolveBlock,
                               reject: @escaping RCTPromiseRejectBlock){
    Proximity.shared.dataPresentation(allowed: false, [])
    resolve(true)
  }
  
  
  /**
   Closes the QR engagement connection.
   It resolves to true after closing the connection.
   
   - Parameters:
   - resolve: The promise to be resolved
   - reject:  The promise to be rejected
   */
  @objc(closeQrEngagement:withRejecter:)
  func closeQrEngagement(
    _ resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    Proximity.shared.stop()
    resolve(true)
  }
  
  /**
   Converts a device requested from the `onDocumentRequestReceived` callback into a serializable JSON.
   
   - Parameters:
   - request: The request returned from `onDocumentRequestReceived` which contains an array of tuples consists of a doctype, namespaces and the requested claims with a boolean value indicating
   wether or not the device which is making the request has an intent to retain the data
   - resolve: The promise to be resolved
   - reject:  The promise to be rejected
   */
  private func deviceRequestToJson(request: (request: [(docType: String, nameSpaces: [String: [String: Bool]])]?, isAuthenticated: Bool)?) -> String? {
    var jsonRequest : [String: [String: [String: Bool]]] = [:]
    request?.request?.forEach({
      item in
      var subReq: [String: [String: Bool]] = [:]
      item.nameSpaces.keys.forEach({
        nameSpace in
        subReq[nameSpace] = item.nameSpaces[nameSpace]
      })
      jsonRequest[item.docType] = subReq
    })
    
    let json: [String: AnyHashable] = [
      "isAuthenticated": request?.isAuthenticated ?? false,
      "request": jsonRequest
    ]
    
    if let jsonData = try? JSONSerialization.data(withJSONObject: json, options: .prettyPrinted),
       let jsonString = String(data: jsonData, encoding: .utf8) {
      return jsonString
    } else {
      return nil
    }
  }
  
  /**
   Sets the proximity handler along with the possible dispatched events and their callsbacks.
   The events are then sent to React Native via `RCTEventEmitter`.
   */
  private func setupProximityHandler() {
    Proximity.shared.proximityHandler = { [weak self] event in
      guard let self = self else { return }
      var eventName: String
      var eventBody: [String: Any] = [:]
      
      switch event {
      case .onBleStart:
        eventName = "onConnecting"
      case .onBleStop:
        eventName = "onDeviceDisconnected"
      case .onDocumentRequestReceived(let request):
        eventName = "onNewDeviceRequest"
        if let request = request {
          let jsonString = deviceRequestToJson(request: request)
          // Here we either send the request or an empty string which signals that something went wrong.
          eventBody = ["message": jsonString ?? ""]
        }
      case .onDocumentPresentationCompleted:
        eventName = "onDeviceRetrievalHelperReady"
      case .onError(let error):
        eventName = "onCommunicationError"
        eventBody = ["error": error.localizedDescription]
      case .onLoading:
        eventName = "onConnecting"
      @unknown default:
        eventName = "unknown"
        eventBody = ["error": "Received an unknown event"]
      }
      
      self.sendEvent(withName: eventName, body: eventBody)
    }
  }
  
  /**
   Wrapper for rejecting with an error.
   Add a new case in order to extend the possible errors.
   */
  private enum ModuleException: String, CaseIterable {
    case qrCodeError = "QR_CODE_ERROR"
    case generateDeviceResponseError = "GENERATE_DEVICE_RESPONSE_ERROR"
    case sendResponseError = "SEND_RESPONSE_ERROR"
    
    func error(
      userInfo: [String : Any]? = nil
    ) -> NSError {
      switch self {
      case .qrCodeError:
        return NSError(domain: self.rawValue, code: -1, userInfo: userInfo)
      case .generateDeviceResponseError:
        return NSError(domain: self.rawValue, code: -1, userInfo: userInfo)
      case .sendResponseError:
        return NSError(domain: self.rawValue, code: -1, userInfo: userInfo)
      }
    }
    
    /// Rejects the provided promise with the appropriate error message and additional data.
    /// - Parameter reject  the promise to be rejected.
    /// - Parameter moreUserInfo additional key-value pairs of data to be passed along with the error.
    func reject(
      reject: RCTPromiseRejectBlock,
      _ moreUserInfo: (String, Any)...
    ) {
      let userInfo = [String: Any](uniqueKeysWithValues: moreUserInfo)
      let error = error(userInfo: userInfo)
      reject("\(error.code)", error.domain, error)
    }
  }
}
