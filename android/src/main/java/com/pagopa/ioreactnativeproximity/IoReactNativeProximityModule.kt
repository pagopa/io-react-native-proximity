package com.pagopa.ioreactnativeproximity

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.modules.core.DeviceEventManagerModule
import it.pagopa.io.wallet.proximity.ProximityLogger
import it.pagopa.io.wallet.proximity.bluetooth.BleRetrievalMethod
import it.pagopa.io.wallet.proximity.qr_code.QrEngagement
import it.pagopa.io.wallet.proximity.qr_code.QrEngagementListener
import it.pagopa.io.wallet.proximity.request.DocRequested
import it.pagopa.io.wallet.proximity.response.ResponseGenerator
import it.pagopa.io.wallet.proximity.wrapper.DeviceRetrievalHelperWrapper
import org.json.JSONObject
import android.util.Base64

class IoReactNativeProximityModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private var qrEngagement: QrEngagement? = null
  private var deviceRetrievalHelper: DeviceRetrievalHelperWrapper? = null

  override fun getName(): String {
    return NAME
  }

  @ReactMethod
  fun initializeQrEngagement(peripheralMode: Boolean, centralClientMode: Boolean, clearBleCache: Boolean, promise: Promise) {
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
  fun generateResponse(jsonDocuments: String, fieldRequestedAndAccepted: String, promise: Promise) {
    try {
      val documents: Array<DocRequested> = parseJsonToDocs(jsonDocuments)
      val sessionTranscript = deviceRetrievalHelper?.sessionTranscript() ?: ByteArray(0)
      val responseGenerator = ResponseGenerator(sessionTranscript)

      responseGenerator.createResponse(
        documents,
        fieldRequestedAndAccepted,
        object : ResponseGenerator.Response {
          override fun onResponseGenerated(response: ByteArray) {
            promise.resolve(Base64.encodeToString(response, Base64.NO_WRAP))
          }

          override fun onError(message: String) {
            promise.reject("RESPONSE_GENERATION_ERROR", message)
          }
        }
      )
    } catch (e: Exception) {
      promise.reject("ERROR_GENERATING_RESPONSE", e.message, e)
    }
  }

  private fun parseJsonToDocs(json: String): Array<DocRequested> {
    return try {
      val jsonObject = JSONObject(json)
      val docRequestedList = mutableListOf<DocRequested>()

      jsonObject.keys().forEach { docType ->
        val documentContent = jsonObject.optString(docType, "")

        if (documentContent.isNotEmpty()) {
          val docRequested = DocRequested(
            content = documentContent,
            alias = "SECURE_STORAGE_KEY_$docType"
          )
          docRequestedList.add(docRequested)
        }
      }
      docRequestedList.toTypedArray()
    } catch (e: Exception) {
      ProximityLogger.e("JSON Parsing Error", "Failed to parse documents: ${e.message}")
      arrayOf()
    }
  }

  private fun setQrEngagementListener() {
    qrEngagement?.withListener(object : QrEngagementListener {
      override fun onConnecting() {
        sendEvent("onConnecting", null)
      }

      override fun onDeviceRetrievalHelperReady(helper: DeviceRetrievalHelperWrapper) {
        deviceRetrievalHelper = helper
        sendEvent("onDeviceRetrievalHelperReady", null)
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

  private fun sendEvent(eventName: String, data: String?) {
    reactApplicationContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(eventName, data)
  }

  companion object {
    const val NAME = "IoReactNativeProximity"
  }
}
