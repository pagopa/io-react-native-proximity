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
import com.facebook.react.bridge.WritableNativeMap
import it.pagopa.io.wallet.cbor.impl.MDoc

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
      ModuleException.QR_ENGAGEMENT_NOT_CONFIGURED_ERROR.reject(promise, Pair(ERROR_KEY, getExceptionMessageOrEmpty(e)))
    }
  }

  @ReactMethod
  fun getQrCodeString(promise: Promise) {
    try {
      qrEngagement?.let {
        val qrCodeString = it.getQrCodeString()
        promise.resolve(qrCodeString)
      } ?: {
        ModuleException.QR_ENGAGEMENT_NOT_DEFINED_ERROR.reject(promise)
      }
    } catch (e: Exception) {
      ModuleException.GET_QR_CODE_ERROR.reject(promise, Pair(ERROR_KEY, getExceptionMessageOrEmpty(e)))
    }
  }

  @ReactMethod
  fun closeQrEngagement(promise: Promise) {
    try {
      qrEngagement?.close()
      deviceRetrievalHelper?.disconnect()
      promise.resolve(true)
    } catch (e: Exception) {
      ModuleException.CLOSE_QR_ENGAGEMENT_ERROR.reject(promise, Pair(ERROR_KEY, getExceptionMessageOrEmpty(e)))
    }
  }

  @ReactMethod
  fun sendErrorResponse(promise: Promise) {
    try {
      qrEngagement?.let {
        it.sendErrorResponse()
        promise.resolve(true)
      } ?: {
        ModuleException.QR_ENGAGEMENT_NOT_DEFINED_ERROR.reject(promise)
      }
    } catch (e: Exception) {
      ModuleException.ERROR_SENDING_ERROR_RESPONSE.reject(promise, Pair(ERROR_KEY, getExceptionMessageOrEmpty(e)))
    }
  }

  @ReactMethod
  fun sendErrorResponseNoData(promise: Promise) {
    try {
      qrEngagement?.let {
        it.sendErrorResponseNoData()
        promise.resolve(true)
      } ?: {
        ModuleException.QR_ENGAGEMENT_NOT_DEFINED_ERROR.reject(promise)
      }
    } catch (e: Exception) {
      ModuleException.ERROR_SENDING_ERROR_NODATA_RESPONSE.reject(promise, Pair(ERROR_KEY, getExceptionMessageOrEmpty(e)))
    }
  }

  @ReactMethod
  fun generateResponse(
    documentCBOR: String,
    fieldRequestedAndAccepted: String,
    alias: String,
    promise: Promise
  ) {
    try {
      if (deviceRetrievalHelper == null) {
        ModuleException.DRH_NOT_DEFINED.reject(promise)
      }
      if (qrEngagement == null) {
        ModuleException.QR_ENGAGEMENT_NOT_DEFINED_ERROR.reject(promise)
      }
      val documents: ArrayList<DocRequested> = arrayListOf()
      val sessionTranscript = deviceRetrievalHelper?.sessionTranscript() ?: ByteArray(0)
      val responseGenerator = ResponseGenerator(sessionTranscript)
      val mDoc = MDoc(documentCBOR)
      mDoc.decodeMDoc(
        onComplete = { model ->
          model.documents?.forEach {
            val encoded = Base64.encodeToString(it.rawValue, Base64.DEFAULT)
            documents.add(DocRequested(encoded, alias))
          }
          responseGenerator.createResponse(
            documents.toTypedArray(),
            fieldRequestedAndAccepted,
            object : ResponseGenerator.Response {
              override fun onResponseGenerated(response: ByteArray) {
                qrEngagement?.sendResponse(response)
                promise.resolve(Base64.encodeToString(response, Base64.NO_WRAP))
              }

              override fun onError(message: String) {
                ModuleException.RESPONSE_GENERATION_ON_ERROR.reject(promise, Pair(ERROR_KEY, message))
              }
            }
          )
        },
        onError = { e: Exception ->
          ModuleException.DECODE_MDOC_ERROR.reject(promise, Pair(ERROR_KEY, getExceptionMessageOrEmpty(e)))
        }
      )
    } catch (e: Exception) {
      ModuleException.GENERIC_GENERATE_RESPONSE_ERROR.reject(promise, Pair(ERROR_KEY, getExceptionMessageOrEmpty(e)))
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

    reactApplicationContext
      .getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
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
    ERROR_SENDING_ERROR_NODATA_RESPONSE(Exception("ERROR_SENDING_ERROR_NODATA_RESPONSE")),
    RESPONSE_GENERATION_ON_ERROR(Exception("RESPONSE_GENERATION_ON_ERROR")),
    DECODE_MDOC_ERROR(Exception("DECODE_MDOC_ERROR")),
    GENERIC_GENERATE_RESPONSE_ERROR(Exception("GENERIC_GENERATE_RESPONSE_ERROR"));

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
