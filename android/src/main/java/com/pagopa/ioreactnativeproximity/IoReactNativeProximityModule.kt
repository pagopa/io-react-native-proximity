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
import com.upokecenter.cbor.CBORObject
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
      promise.reject("QR_ENGAGEMENT_ERROR", e.message)
    }
  }

  @ReactMethod
  fun getQrCodeString(promise: Promise) {
    try {
      if (qrEngagement == null) {
        promise.reject("ERROR", "QR Engagement not initialized or invalid")
        return
      }
      val qrCodeString = qrEngagement?.getQrCodeString()
      promise.resolve(qrCodeString)
    } catch (e: Exception) {
      promise.reject("QR_CODE_ERROR", e.message)
    }
  }

  @ReactMethod
  fun closeQrEngagement(promise: Promise) {
    try {
      qrEngagement?.close()
      deviceRetrievalHelper?.disconnect()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("CLOSE_ERROR", e.message)
    }
  }

  @ReactMethod
  fun generateResponse(
    jsonDocuments: String,
    fieldRequestedAndAccepted: String,
    alias: String,
    promise: Promise
  ) {
    try {
      val bytes = jsonDocuments.chunked(2)
        .map { it.toInt(16).toByte() }
        .toByteArray()
      val documents: ArrayList<DocRequested> = arrayListOf()
      val sessionTranscript = deviceRetrievalHelper?.sessionTranscript() ?: ByteArray(0)
      val responseGenerator = ResponseGenerator(sessionTranscript)
      val encoded64 = Base64.encode(bytes, Base64.DEFAULT)
      val mDoc = MDoc(encoded64)
      mDoc.decodeMDoc(
        onComplete = { model ->
          model.documents?.forEach {
            documents.add(DocRequested(Base64.encodeToString(it.rawValue, Base64.DEFAULT), alias))
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
                promise.reject("RESPONSE_GENERATION_ERROR", message)
              }
            }
          )
        },
        onError = { ex ->
          promise.resolve("not ok")
        }
      )
    } catch (e: Exception) {
      Log.e("RES", e.stackTraceToString())
      promise.reject("ERROR_GENERATING_RESPONSE", e.message, e)
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

  companion object {
    const val NAME = "IoReactNativeProximity"
  }
}

object Utils {
  fun hexStringToByteArray(s: String): ByteArray {
    return hexToByte(s)
  }

  private fun hexToByte(hexString: String): ByteArray {
    val byteArray = ByteArray(hexString.length / 2)
    var i = 0
    while (i < hexString.length) {
      byteArray[i / 2] = (hexToByte(hexString[i]) * 16 + hexToByte(hexString[i + 1])).toByte()
      i += 2
    }
    return byteArray
  }

  private fun hexToByte(ch: Char): Int {
    if (ch in '0'..'9') return ch.code - '0'.code
    if (ch in 'A'..'F') return ch.code - 'A'.code + 10
    return if (ch in 'a'..'f') ch.code - 'a'.code + 10 else -1
  }
}
