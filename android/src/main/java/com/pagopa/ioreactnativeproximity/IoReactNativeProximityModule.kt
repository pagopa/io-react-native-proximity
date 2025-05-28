package com.pagopa.ioreactnativeproximity

import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.WritableNativeMap
import it.pagopa.io.wallet.proximity.bluetooth.BleRetrievalMethod
import it.pagopa.io.wallet.proximity.qr_code.QrEngagement
import it.pagopa.io.wallet.proximity.qr_code.QrEngagementListener
import it.pagopa.io.wallet.proximity.request.DocRequested
import it.pagopa.io.wallet.proximity.response.ResponseGenerator
import it.pagopa.io.wallet.proximity.session_data.SessionDataStatus
import it.pagopa.io.wallet.proximity.wrapper.DeviceRetrievalHelperWrapper


class IoReactNativeProximityModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String {
    return NAME
  }

  private var qrEngagement: QrEngagement? = null
  private var deviceRetrievalHelper: DeviceRetrievalHelperWrapper? = null

  /**
   * Starts the proximity flow by allocating the necessary resources and initializing the Bluetooth stack.
   * Resolves to true or rejects if an error occurs.
   * @param peripheralMode - Whether the device is in peripheral mode. Defaults to true
   * @param centralClientMode - Whether the device is in central client mode. Defaults to false
   * @param clearBleCache - Whether the BLE cache should be cleared. Defaults to true
   * @param certificates - Array of base64 representing DER encoded X.509 certificate which are used to authenticate the verifier app
   * @param promise - The promise which will be resolved in case of success or rejected in case of failure.
   */
  @ReactMethod
  fun start(
    peripheralMode: Boolean,
    centralClientMode: Boolean,
    clearBleCache: Boolean,
    certificates: ReadableArray,
    promise: Promise
  ) {
    try {
      val retrievalMethod = BleRetrievalMethod(
        peripheralServerMode = peripheralMode,
        centralClientMode = centralClientMode,
        clearBleCache = clearBleCache
      )

      val certificatesList = parseCertificates(certificates)
      qrEngagement = QrEngagement.build(reactApplicationContext, listOf(retrievalMethod)).apply {
        if (certificatesList.isNotEmpty()) {
          withReaderTrustStore(certificatesList)
        }
      }
      qrEngagement?.configure()
      setupProximityHandler()
      promise.resolve(true)
    } catch (e: Exception) {
      ModuleException.START_ERROR.reject(
        promise,
        Pair(ERROR_KEY, getExceptionMessageOrEmpty(e))
      )
    }
  }

  /**
   * Utility function to parse an array coming from the React Native Bridge into an ArrayList
   * of ByteArray representing DER encoded X.509 certificates.
   * @param certificates - Array of base64 strings representing DER encoded X.509 certificate
   * @returns An ArrayList of ByteArray representing DER encoded X.509 certificates.
   * @throws ClassCastException if the element in the array is not a string
   */
  private fun parseCertificates(certificates: ReadableArray): ArrayList<ByteArray> {
    return ArrayList(
      (0 until certificates.size())
        .mapNotNull { i ->
          certificates.getString(i).let { cert ->
            Base64.decode(cert, Base64.DEFAULT)
          }
        }
    )
  }

  /**
   * Creates a QR code to be scanned in order to initialize the presentation.
   * Resolves with the QR code strings.
   * @param promise - The promise which will be resolved in case of success or rejected in case of failure.
   */
  @ReactMethod
  fun getQrCodeString(promise: Promise) {
    try {
      qrEngagement?.let {
        val qrCodeString = it.getQrCodeString()
        promise.resolve(qrCodeString)
      } ?: run {
        ModuleException.QR_ENGAGEMENT_NOT_DEFINED_ERROR.reject(promise)
      }
    } catch (e: Exception) {
      ModuleException.GET_QR_CODE_ERROR.reject(
        promise,
        Pair(ERROR_KEY, getExceptionMessageOrEmpty(e))
      )
    }
  }

  /**
   * Closes the bluetooth connection and clears any resource.
   * It resolves to true after closing the connection.
   * @param promise - The promise which will be resolved in case of success or rejected in case of failure.
   */
  @ReactMethod
  fun close(promise: Promise) {
    try {
      qrEngagement?.close()
      deviceRetrievalHelper?.disconnect()
      promise.resolve(true)
    } catch (e: Exception) {
      ModuleException.CLOSE_QR_ENGAGEMENT_ERROR.reject(
        promise,
        Pair(ERROR_KEY, getExceptionMessageOrEmpty(e))
      )
    }
  }

  /**
   * Sends an error response during the presentation according to the SessionData status codes defined in table 20 of the ISO18013-5 standard.
   * @param code - The status error to be sent is a long type but the bridge only maps double values. It is converted to a long.
   * The accepted values are defined in ``SessionDataStatus`` as follows:
   *  10 -> Error: session encryption
   *  11 -> Error: CBOR decoding
   *  20 -> Session termination
   * @param promise - The promise which will be resolved in case of success or rejected in case of failure.
   */
  @ReactMethod
  fun sendErrorResponse(code:Double, promise: Promise) {
    try {
      qrEngagement?.let { it ->
        val sessionDataStatus = SessionDataStatus.entries.find { it.value == code.toLong() }
        if(sessionDataStatus != null){
          it.sendErrorResponse(sessionDataStatus)
          promise.resolve(true)
        }else {
          ModuleException.SEND_ERROR_RESPONSE_ERROR.reject(
            promise,
            Pair(ERROR_KEY, "Invalid status code")
          )
        }
      } ?: run {
        ModuleException.QR_ENGAGEMENT_NOT_DEFINED_ERROR.reject(promise)
      }
    } catch (e: Exception) {
      ModuleException.SEND_ERROR_RESPONSE_ERROR.reject(
        promise,
        Pair(ERROR_KEY, getExceptionMessageOrEmpty(e))
      )
    }
  }

  /**
   * Utility function which extracts the document shape we expect to receive from the bridge
   * in the one expected by {DocRequested}.
   * @param documents - A {ReadableArray} containing the documents receive from the bridge
   * @returns An array containing a {DocRequested} object for each document in {documents}
   */
  private fun getDocRequestedArrayList(documents: ReadableArray): ArrayList<DocRequested> {
    return ArrayList(
      (0 until documents.size())
        .mapNotNull { i ->
          val doc = documents.getMap(i)
          val alias = doc?.getString("alias")
          val issuerSignedContent = doc?.getString("issuerSignedContent")
          val docType = doc?.getString("docType")

          if (alias != null && issuerSignedContent != null && docType != null) {
            DocRequested(issuerSignedContent, alias, docType)
          } else {
            null
          }
        }
    )
  }

  /**
   * Generates a response which can later be sent with {sendResponse} with the provided
   * CBOR documents and the requested attributes.
   * @param documents - A ReadableArray containing a map with alias, issuerSignedContent and docType as strings.
   * @param fieldRequestedAndAccepted - The string containing the requested attributes. This is
   * provided by the {onNewDeviceRequest} callback provided by {setupProximityHandler} .
   * @param promise - The promise which will be resolved in case of success or rejected in case of failure.
   */
  @ReactMethod
  fun generateResponse(
    documents: ReadableArray,
    fieldRequestedAndAccepted: ReadableMap,
    promise: Promise
  ) {
    try {
      deviceRetrievalHelper?.let { devHelper ->
        // Get the DocRequested list and if it's empty then reject the promise and return
        val docRequestedList = getDocRequestedArrayList(documents)
        if (docRequestedList.isEmpty()) {
          ModuleException.WRONG_DOCUMENTS_FORMAT.reject(promise)
          return
        }

        val sessionTranscript = devHelper.sessionTranscript()
        val responseGenerator = ResponseGenerator(sessionTranscript)
        responseGenerator.createResponse(docRequestedList.toTypedArray(),
          fieldRequestedAndAccepted.toString(),
          object : ResponseGenerator.Response {
            override fun onResponseGenerated(response: ByteArray) {
              promise.resolve(Base64.encodeToString(response, Base64.NO_WRAP))
            }

            override fun onError(message: String) {
              ModuleException.RESPONSE_GENERATION_ON_ERROR.reject(
                promise,
                Pair(ERROR_KEY, message)
              )
            }
          })
      } ?: run {
        ModuleException.DRH_NOT_DEFINED.reject(promise)
      }
    } catch (e: Exception) {
      ModuleException.GENERIC_GENERATE_RESPONSE_ERROR.reject(
        promise,
        Pair(ERROR_KEY, getExceptionMessageOrEmpty(e))
      )
    }
  }

  /**
   * Sends a response containing the documents and the fields which the user decided to present generated by {generateResponse}.
   * It resolves to true after sending the response, otherwise it rejects if an error occurs while decoding the response.
   * Currently there's not evidence of the verifier app responding to this request, thus we don't handle the response.
   * @param response - A base64 encoded string containing the response generated by {generateResponse}
   * @param promise - The promise which will be resolved in case of success or rejected in case of failure.
   */
  @ReactMethod
  fun sendResponse(response: String, promise: Promise) {
    try {
      qrEngagement?.let { qrEng ->
        val responseBytes = Base64.decode(response, Base64.NO_WRAP)
        qrEng.sendResponse(responseBytes)
        promise.resolve(true)
      }
        ?: run {
          ModuleException.QR_ENGAGEMENT_NOT_DEFINED_ERROR.reject(promise)
        }
    } catch (e: Exception) {
      ModuleException.SEND_RESPONSE_ERROR.reject(
        promise,
        Pair(ERROR_KEY, getExceptionMessageOrEmpty(e))
      )
    }
  }


  /**
   * Sets the proximity handler along with the possible dispatched events and their callbacks.
   * The events are then sent to React Native via `RCTEventEmitter`.
   * onDeviceConnecting: Emitted when the device is connecting to the verifier app.
   * onDeviceConnected: Emitted when the device is connected to the verifier app.
   * onDocumentRequestReceived: Emitted when a document request is received from the verifier app. Carries a payload containing the request data.
   * onDeviceDisconnected: Emitted when the device is disconnected from the verifier app.
   * onError: Emitted when an error occurs. Carries a payload containing the error data.
   */
  private fun setupProximityHandler() {
    qrEngagement?.withListener(object : QrEngagementListener {
      override fun onDeviceConnecting() {
        sendEvent("onDeviceConnecting", "")
      }

      override fun onDeviceConnected(deviceRetrievalHelper: DeviceRetrievalHelperWrapper) {
        this@IoReactNativeProximityModule.deviceRetrievalHelper = deviceRetrievalHelper
        sendEvent("onDeviceConnected", "")
      }

      override fun onError(error: Throwable) {
        val data = error.message ?: ""
        sendEvent("onDeviceConnected", data)
      }

      override fun onDocumentRequestReceived(request: String?, sessionsTranscript: ByteArray){
        val data: WritableMap = Arguments.createMap()
        data.putString("data", request)
        sendEvent("onDocumentRequestReceived", data)
      }

      override fun onDeviceDisconnected(transportSpecificTermination: Boolean) {
        sendEvent("onDeviceDisconnected", transportSpecificTermination.toString())
      }
    })
  }

  /**
   * Wrapper function to send an event via `RCTEventEmitter`
   * @param eventName - The event name
   * @param data - The data attached to eventName
   */
  private fun sendEvent(eventName: String, data: Any?) {
    reactApplicationContext.getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(eventName, data)
  }

  @ReactMethod
  fun addListener(eventName: String?) {
    /* Keep: Required for RN built in Event Emitter Calls.
    This fixes the warning: `new NativeEventEmitter()` was called with a non-null argument without the required `removeListeners` method
     */
  }

  @ReactMethod
  fun removeListeners(count: Int?) {
    /*Keep: Required for RN built in Event Emitter Calls.
    This fixes the warning: `new NativeEventEmitter()` was called with a non-null argument without the required `removeListeners` method
    */
  }

  private enum class ModuleException(
    val ex: Exception
  ) {
    DRH_NOT_DEFINED(Exception("DRH_NOT_DEFINED")),
    QR_ENGAGEMENT_NOT_DEFINED_ERROR(Exception("QR_ENGAGEMENT_NOT_DEFINED_ERROR")),
    START_ERROR(Exception("START_ERROR")),
    GET_QR_CODE_ERROR(Exception("GET_QR_CODE_ERROR")),
    CLOSE_QR_ENGAGEMENT_ERROR(Exception("CLOSE_QR_ENGAGEMENT_ERROR")),
    SEND_ERROR_RESPONSE_ERROR(Exception("SEND_ERROR_RESPONSE_ERROR")),
    RESPONSE_GENERATION_ON_ERROR(Exception("RESPONSE_GENERATION_ON_ERROR")),
    GENERIC_GENERATE_RESPONSE_ERROR(Exception("GENERIC_GENERATE_RESPONSE_ERROR")),
    WRONG_DOCUMENTS_FORMAT(Exception("WRONG_DOCUMENTS_FORMAT")),
    SEND_RESPONSE_ERROR(Exception("SEND_RESPONSE_ERROR"));

    fun reject(
      promise: Promise, vararg args: Pair<String, String>
    ) {
      exMap(*args).let {
        promise.reject(it.first, ex.message, it.second)
      }
    }

    private fun exMap(vararg args: Pair<String, String>): Pair<String, WritableMap> {
      val writableMap = WritableNativeMap()
      args.forEach { writableMap.putString(it.first, it.second) }
      return Pair(this.ex.message ?: "UNKNOWN", writableMap)
    }
  }

  private fun getExceptionMessageOrEmpty(e: Exception): String = e.message ?: ""

  companion object {
    const val NAME = "IoReactNativeProximity"
    const val ERROR_KEY = "error"
  }
}
