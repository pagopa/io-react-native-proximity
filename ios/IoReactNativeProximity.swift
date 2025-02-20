import Foundation
import IOWalletProximity
import React

@objc(IoReactNativeProximity)
class IoReactNativeProximity: RCTEventEmitter {

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

    @objc
    func getQrCodeString(
      _ resolve: @escaping RCTPromiseResolveBlock,
      reject: @escaping RCTPromiseRejectBlock
    ) {
        if let qrCodeString = Proximity.shared.start() {
            resolve(qrCodeString)
        } else {
            let error = NSError(domain: "IoReactNativeProximity", code: 0,
                                userInfo: [NSLocalizedDescriptionKey: "Failed to retrieve QR code string"])
            reject("no_qr_code", "QR code string is nil", error)
        }
    }

    @objc
    func closeQrEngagement(
      _ resolve: @escaping RCTPromiseResolveBlock,
      reject: @escaping RCTPromiseRejectBlock
    ) {
        Proximity.shared.stop()
        resolve(true)
    }
  
  
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
              // FIXME
                eventName = "onNewDeviceRequest"
                if let request = request {
                  eventBody = ["message": request.request ?? []]
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
}
