package com.pagopa.ioreactnativeproximity

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import it.pagopa.io.wallet.proximity.bluetooth.BleRetrievalMethod
import it.pagopa.io.wallet.proximity.qr_code.QrEngagement
import it.pagopa.io.wallet.proximity.qr_code.QrEngagementListener
import it.pagopa.io.wallet.proximity.request.DocRequested
import it.pagopa.io.wallet.proximity.response.ResponseGenerator
import it.pagopa.io.wallet.proximity.wrapper.DeviceRetrievalHelperWrapper
import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableNativeMap

class IoReactNativeProximityModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String {
    return NAME
  }

  private var qrEngagement: QrEngagement? = null
  private var deviceRetrievalHelper: DeviceRetrievalHelperWrapper? = null

  @ReactMethod
  fun initializeQrEngagement(
    peripheralMode: Boolean,
    centralClientMode: Boolean,
    clearBleCache: Boolean,
    promise: Promise
  ) {
    try {
      val retrievalMethod = BleRetrievalMethod(
        peripheralServerMode = peripheralMode,
        centralClientMode = centralClientMode,
        clearBleCache = clearBleCache
      )

      qrEngagement = QrEngagement.build(reactApplicationContext, listOf(retrievalMethod))
      qrEngagement?.configure()
      setQrEngagementListener()
      promise.resolve(true)
    } catch (e: Exception) {
      ModuleException.QR_ENGAGEMENT_NOT_CONFIGURED_ERROR.reject(
        promise,
        Pair(ERROR_KEY, getExceptionMessageOrEmpty(e))
      )
    }
  }

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

  @ReactMethod
  fun closeQrEngagement(promise: Promise) {
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

  @ReactMethod
  fun sendErrorResponse(promise: Promise) {
    try {
      qrEngagement?.let {
        it.sendErrorResponse()
        promise.resolve(true)
      } ?: run {
        ModuleException.QR_ENGAGEMENT_NOT_DEFINED_ERROR.reject(promise)
      }
    } catch (e: Exception) {
      ModuleException.ERROR_SENDING_ERROR_RESPONSE.reject(
        promise,
        Pair(ERROR_KEY, getExceptionMessageOrEmpty(e))
      )
    }
  }

  @ReactMethod
  fun sendErrorResponseNoData(promise: Promise) {
    try {
      qrEngagement?.let {
        it.sendErrorResponseNoData()
        promise.resolve(true)
      } ?: run {
        ModuleException.QR_ENGAGEMENT_NOT_DEFINED_ERROR.reject(promise)
      }
    } catch (e: Exception) {
      ModuleException.ERROR_SENDING_ERROR_NO_DATA_RESPONSE.reject(
        promise,
        Pair(ERROR_KEY, getExceptionMessageOrEmpty(e))
      )
    }
  }

  /**
   * Utility function which extracts the document shape we expect to receive from the bridge
   * in the one expected by {DocRequested}.
   */
  private fun getDocRequestedArrayList(documents: ReadableArray): ArrayList<DocRequested> {
    return ArrayList(
      (0 until documents.size())
        .mapNotNull { i ->
          val doc = documents.getMap(i)
          val alias = doc.getString("alias")
          val issuerSignedContent = doc.getString("issuerSignedContent")
          val docType = doc.getString("docType")

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
   * provided by the {onNewDeviceRequest} callback provided by {setQrEngagementListener} .
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


  private fun setQrEngagementListener() {
    qrEngagement?.withListener(object : QrEngagementListener {
      override fun onConnecting() {
        sendEvent("onConnecting", "")
      }

      override fun onDeviceRetrievalHelperReady(deviceRetrievalHelper: DeviceRetrievalHelperWrapper) {
        this@IoReactNativeProximityModule.deviceRetrievalHelper = deviceRetrievalHelper
        sendEvent("onDeviceRetrievalHelperReady", "")
      }

      override fun onCommunicationError(msg: String) {
        sendEvent("onCommunicationError", msg)
      }

      override fun onNewDeviceRequest(request: String?, sessionsTranscript: ByteArray) {
        sendEvent("onNewDeviceRequest", request ?: "")
      }

      override fun onDeviceDisconnected(transportSpecificTermination: Boolean) {
        sendEvent("onDeviceDisconnected", transportSpecificTermination.toString())
      }
    })
  }

  private fun sendEvent(eventName: String, message: String) {
    val params: WritableMap = Arguments.createMap()
    params.putString("message", message)

    reactApplicationContext.getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(eventName, params)
  }

  private enum class ModuleException(
    val ex: Exception
  ) {
    DRH_NOT_DEFINED(Exception("DRH_NOT_DEFINED")),
    QR_ENGAGEMENT_NOT_DEFINED_ERROR(Exception("QR_ENGAGEMENT_NOT_DEFINED_ERROR")),
    QR_ENGAGEMENT_NOT_CONFIGURED_ERROR(Exception("QR_ENGAGEMENT_NOT_CONFIGURED_ERROR")),
    GET_QR_CODE_ERROR(Exception("GET_QR_CODE_ERROR")),
    CLOSE_QR_ENGAGEMENT_ERROR(Exception("CLOSE_QR_ENGAGEMENT_ERROR")),
    ERROR_SENDING_ERROR_RESPONSE(Exception("ERROR_SENDING_ERROR_RESPONSE")),
    ERROR_SENDING_ERROR_NO_DATA_RESPONSE(Exception("ERROR_SENDING_ERROR_NODATA_RESPONSE")),
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
