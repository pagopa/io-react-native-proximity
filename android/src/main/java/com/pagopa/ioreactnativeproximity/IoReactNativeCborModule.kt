package com.pagopa.ioreactnativeproximity

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.WritableNativeMap
import it.pagopa.io.wallet.cbor.cose.COSEManager
import it.pagopa.io.wallet.cbor.cose.FailureReason
import it.pagopa.io.wallet.cbor.cose.SignWithCOSEResult
import it.pagopa.io.wallet.cbor.parser.CBorParser
import it.pagopa.io.wallet.proximity.OpenID4VP
import it.pagopa.io.wallet.proximity.request.DocRequested
import it.pagopa.io.wallet.proximity.response.ResponseGenerator
import kotlin.io.encoding.ExperimentalEncodingApi

class IoReactNativeCborModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String {
    return NAME
  }

  @OptIn(ExperimentalEncodingApi::class)
  @ReactMethod
  fun decode(data: String, promise: Promise) {
    val buffer = try {
      kotlin.io.encoding.Base64.decode(data)
    } catch (e: Exception) {
      ModuleException.INVALID_ENCODING.reject(promise, Pair(ERROR_USER_INFO_KEY, e.message.orEmpty()))
      return;
    }

    try {
      CBorParser(buffer).toJson()?.let {
        promise.resolve(it)
      }?: run {
        ModuleException.UNABLE_TO_DECODE.reject(promise)
      }
    } catch (e: Exception) {
      ModuleException.UNKNOWN_EXCEPTION.reject(promise, Pair(ERROR_USER_INFO_KEY, e.message.orEmpty()))
    }
  }

  @OptIn(ExperimentalEncodingApi::class)
  @ReactMethod
  fun decodeDocuments(data: String, promise: Promise) {
    val buffer = try {
      kotlin.io.encoding.Base64.decode(data)
    } catch (e: Exception) {
      ModuleException.INVALID_ENCODING.reject(promise, Pair(ERROR_USER_INFO_KEY, e.message.orEmpty()))
      return;
    }
    try {
      CBorParser(buffer).documentsCborToJson(separateElementIdentifier = true, onComplete = {
        promise.resolve(it)
      }) { ex ->
        ModuleException.UNABLE_TO_DECODE.reject(promise, Pair(ERROR_USER_INFO_KEY, ex.message.orEmpty()))
      }
    } catch (e: Exception) {
      ModuleException.UNKNOWN_EXCEPTION.reject(promise, Pair(ERROR_USER_INFO_KEY, e.message.orEmpty()))
    }
  }

  @OptIn(ExperimentalEncodingApi::class)
  @ReactMethod
  fun decodeIssuerSigned(issuerSigned: String, promise: Promise) {
    val buffer = try {
      kotlin.io.encoding.Base64.decode(issuerSigned)
    } catch (e: Exception) {
      ModuleException.INVALID_ENCODING.reject(promise, Pair(ERROR_USER_INFO_KEY, e.message.orEmpty()))
      return;
    }
    try {
      CBorParser(buffer).issuerSignedCborToJson(separateElementIdentifier = true).let {
        if (it == null) {
          ModuleException.UNABLE_TO_DECODE.reject(promise, Pair(ERROR_USER_INFO_KEY, "Unable to decode passed CBOR"))
          return
        }
        promise.resolve(it)
      }
    } catch (e: Exception) {
      ModuleException.UNKNOWN_EXCEPTION.reject(promise, Pair(ERROR_USER_INFO_KEY, e.message.orEmpty()))
    }
  }

  @OptIn(ExperimentalEncodingApi::class)
  @ReactMethod
  fun sign(payload: String, keyTag: String, promise: Promise) {
    val data = try {
      kotlin.io.encoding.Base64.decode(payload)
    } catch (e: Exception) {
      ModuleException.INVALID_ENCODING.reject(promise, Pair(ERROR_USER_INFO_KEY, e.message.orEmpty()))
      return;
    }

    try {
      val result = COSEManager().signWithCOSE(
        data = data,
        alias = keyTag
      )
      when (result) {
        is SignWithCOSEResult.Failure -> {
          when (result.reason) {
            FailureReason.NO_KEY -> ModuleException.PUBLIC_KEY_NOT_FOUND.reject(
              promise,
              Pair(ERROR_USER_INFO_KEY, result.reason.msg)
            )

            FailureReason.FAIL_TO_SIGN -> ModuleException.UNABLE_TO_SIGN.reject(
              promise,
              Pair(ERROR_USER_INFO_KEY, result.reason.msg)
            )

            else -> ModuleException.UNKNOWN_EXCEPTION.reject(
              promise,
              Pair(ERROR_USER_INFO_KEY, result.reason.msg)
            )
          }
        }

        is SignWithCOSEResult.Success -> {
          promise.resolve(kotlin.io.encoding.Base64.encode(result.signature))
        }
      }
    } catch (e: Exception) {
      ModuleException.UNKNOWN_EXCEPTION.reject(promise, Pair(ERROR_USER_INFO_KEY, e.message.orEmpty()))
    }
  }

  @OptIn(ExperimentalEncodingApi::class)
  @ReactMethod
  fun verify(sign1Data: String, publicKey: ReadableMap, promise: Promise) {
    val data = try {
      kotlin.io.encoding.Base64.decode(sign1Data)
    } catch (e: Exception) {
      ModuleException.INVALID_ENCODING.reject(promise, Pair(ERROR_USER_INFO_KEY, e.message.orEmpty()))
      return;
    }

    try {
      val result = COSEManager().verifySign1FromJWK(
        dataSigned = data,
        jwk = publicKey.toString()
      )
      promise.resolve(result)
    } catch (e: Exception) {
      ModuleException.UNKNOWN_EXCEPTION.reject(promise, Pair(ERROR_USER_INFO_KEY, e.message.orEmpty()))
    }
  }

  @OptIn(ExperimentalEncodingApi::class)
  @ReactMethod
  fun generateOID4VPDeviceResponse(clientId : String, responseUri : String, authorizationRequestNonce : String,
                                   mdocGeneratedNonce : String, documents : ReadableArray,
                                   fieldRequestedAndAccepted : String, promise : Promise) {
    val sessionTranscript = try {
      OpenID4VP(
        clientId,
        responseUri,
        authorizationRequestNonce,
        mdocGeneratedNonce
      ).createSessionTranscript()
    } catch (e : Exception) {
      ModuleException.UNABLE_TO_GENERATE_TRANSCRIPT.reject(promise, Pair(ERROR_USER_INFO_KEY, e.message.orEmpty()))
      return
    }

    val documentsParsed = try {
      parseDocRequested(documents)
    } catch (e : Exception) {
      ModuleException.INVALID_DOC_REQUESTED.reject(promise, Pair(ERROR_USER_INFO_KEY, e.message.orEmpty()))
      return
    }

    try {
      val responseGenerator = ResponseGenerator(sessionTranscript)
      responseGenerator.createResponse(
        documentsParsed,
        fieldRequestedAndAccepted,
        object : ResponseGenerator.Response {
          override fun onResponseGenerated(response: ByteArray) {
            promise.resolve(kotlin.io.encoding.Base64.encode(response))
          }

          override fun onError(message: String) {
            ModuleException.UNABLE_TO_GENERATE_RESPONSE.reject(promise, Pair(ERROR_USER_INFO_KEY, message))
          }
        }
      )
    } catch (e : Exception) {
      ModuleException.UNKNOWN_EXCEPTION.reject(promise, Pair(ERROR_USER_INFO_KEY, e.message.orEmpty()))
    }
  }

  companion object {
    const val NAME = "IoReactNativeCbor"
    const val ERROR_USER_INFO_KEY = "error"

    private fun parseDocRequested(array: ReadableArray): Array<DocRequested> {
      val retVal = mutableListOf<DocRequested>()
      for (i in 0..<array.size()) {
        val entry = array.getMap(i)
        if(entry === null){
          throw Exception("Entry in ReadableMap is null")
        }
        if (
          !entry.hasKey("alias") || entry.getType("alias") != ReadableType.String ||
          !entry.hasKey("issuerSignedContent") || entry.getType("issuerSignedContent") != ReadableType.String ||
          !entry.hasKey("docType") || entry.getType("docType") != ReadableType.String
        ) throw ModuleException.UNABLE_TO_DECODE.ex
        retVal.add(DocRequested(
          alias = entry.getString("alias")!!,
          issuerSignedContent = entry.getString("issuerSignedContent")!!,
          docType = entry.getString("docType")!!
        ))
      }

      return retVal.toTypedArray()
    }

    private enum class ModuleException(
      val ex: Exception
    ) {
      UNABLE_TO_DECODE(Exception("UNABLE_TO_DECODE")),
      PUBLIC_KEY_NOT_FOUND(Exception("PUBLIC_KEY_NOT_FOUND")),
      UNABLE_TO_SIGN(Exception("UNABLE_TO_SIGN")),
      INVALID_ENCODING(Exception("INVALID_ENCODING")),
      UNABLE_TO_GENERATE_TRANSCRIPT(Exception("UNABLE_TO_GENERATE_TRANSCRIPT")),
      INVALID_DOC_REQUESTED(Exception("INVALID_DOC_REQUESTED")),
      UNABLE_TO_GENERATE_RESPONSE(Exception("UNABLE_TO_GENERATE_RESPONSE")),
      UNKNOWN_EXCEPTION(Exception("UNKNOWN_EXCEPTION"));

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
  }
}
