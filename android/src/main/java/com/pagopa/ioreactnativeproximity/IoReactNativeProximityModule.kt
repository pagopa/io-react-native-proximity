package com.pagopa.ioreactnativeproximity

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import it.pagopa.io.wallet.proximity.ProximityLogger
import it.pagopa.io.wallet.proximity.bluetooth.BleRetrievalMethod
import it.pagopa.io.wallet.proximity.qr_code.QrEngagement
import it.pagopa.io.wallet.proximity.qr_code.QrEngagementListener
import it.pagopa.io.wallet.proximity.request.DocRequested
import it.pagopa.io.wallet.proximity.response.ResponseGenerator
import it.pagopa.io.wallet.proximity.wrapper.DeviceRetrievalHelperWrapper
import org.json.JSONObject
import android.util.Base64
import android.util.Log

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
  fun generateResponse(jsonDocuments: String, fieldRequestedAndAccepted: String, alias: String, promise: Promise) {
    try {
      val documents: Array<DocRequested> = arrayOf(DocRequested(Base64.encodeToString(jsonDocuments.toByteArray(), Base64.DEFAULT), alias))
      val sessionTranscript = deviceRetrievalHelper?.sessionTranscript() ?: ByteArray(0)
      val responseGenerator = ResponseGenerator(sessionTranscript)
      Log.e("RES", documents.contentToString())
      Log.e("RES", fieldRequestedAndAccepted)
      responseGenerator.createResponse(
        documents,
        fieldRequestedAndAccepted,
        object : ResponseGenerator.Response {
          override fun onResponseGenerated(response: ByteArray) {
            Log.e("RES", response.decodeToString())
            promise.resolve(Base64.encodeToString(response, Base64.NO_WRAP))
          }

          override fun onError(message: String) {
            promise.reject("RESPONSE_GENERATION_ERROR", message)
          }
        }
      )
    } catch (e: Exception) {
      Log.e("RES", e.stackTraceToString())
      promise.reject("ERROR_GENERATING_RESPONSE", e.message, e)
    }
  }


  private fun parseJsonToDocs(json: String, alias: String): Array<DocRequested> {
    return try {
      val jsonObject = JSONObject(json)
      val docRequestedList = mutableListOf<DocRequested>()

      jsonObject.keys().forEach { docType ->
        val documentContent = jsonObject.optString(docType, "")

        if (documentContent.isNotEmpty()) {
          val docRequested = DocRequested(
            content = documentContent,
            alias = alias
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
