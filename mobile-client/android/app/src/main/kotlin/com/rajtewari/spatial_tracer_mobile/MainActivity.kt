package com.rajtewari.spatial_tracer_mobile

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Log
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarkerResult
import com.google.mediapipe.tasks.vision.core.RunningMode
import java.io.File
import java.io.FileOutputStream

class MainActivity : FlutterActivity() {
    private val CHANNEL = "com.rajtewari/hand_tracker"
    private var handLandmarker: HandLandmarker? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "initTracker" -> {
                    try {
                        initHandLandmarker()
                        result.success(true)
                    } catch (e: Exception) {
                        result.error("INIT_ERROR", e.message, null)
                    }
                }
                "processFrame" -> {
                    val bytes = call.argument<ByteArray>("imageBytes")
                    val width = call.argument<Int>("width") ?: 640
                    val height = call.argument<Int>("height") ?: 480
                    val timestamp = call.argument<Long>("timestamp") ?: 0L

                    if (bytes != null) {
                        try {
                            val landmarks = processFrame(bytes, width, height, timestamp)
                            result.success(landmarks)
                        } catch (e: Exception) {
                            result.error("PROCESS_ERROR", e.message, null)
                        }
                    } else {
                        result.error("NO_DATA", "No image bytes", null)
                    }
                }
                "dispose" -> {
                    handLandmarker?.close()
                    handLandmarker = null
                    result.success(true)
                }
                else -> result.notImplemented()
            }
        }
    }

    private fun initHandLandmarker() {
        // Copy model from assets to cache
        val modelFile = File(cacheDir, "hand_landmarker.task")
        if (!modelFile.exists()) {
            assets.open("hand_landmarker.task").use { input ->
                FileOutputStream(modelFile).use { output ->
                    input.copyTo(output)
                }
            }
        }

        val baseOptions = BaseOptions.builder()
            .setModelAssetPath(modelFile.absolutePath)
            .build()

        val options = HandLandmarker.HandLandmarkerOptions.builder()
            .setBaseOptions(baseOptions)
            .setRunningMode(RunningMode.VIDEO)
            .setNumHands(1)
            .setMinHandDetectionConfidence(0.5f)
            .setMinTrackingConfidence(0.5f)
            .build()

        handLandmarker = HandLandmarker.createFromOptions(this, options)
    }

    private fun processFrame(bytes: ByteArray, width: Int, height: Int, timestamp: Long): Map<String, Any> {
        val landmarker = handLandmarker ?: return mapOf("hands" to emptyList<Any>())

        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val buffer = java.nio.ByteBuffer.wrap(bytes)
        bitmap.copyPixelsFromBuffer(buffer)

        val mpImage = BitmapImageBuilder(bitmap).build()
        val result: HandLandmarkerResult = landmarker.detectForVideo(mpImage, timestamp)

        val handsData = mutableListOf<Map<String, Any>>()

        result.landmarks().forEachIndexed { idx, handLandmarks ->
            val lmList = mutableListOf<Map<String, Double>>()
            handLandmarks.forEachIndexed { lmIdx, lm ->
                lmList.add(mapOf(
                    "id" to lmIdx.toDouble(),
                    "x" to lm.x().toDouble(),
                    "y" to lm.y().toDouble(),
                    "z" to lm.z().toDouble()
                ))
            }

            val handedness = if (result.handednesses().size > idx) {
                result.handednesses()[idx][0].categoryName()
            } else "Unknown"

            handsData.add(mapOf(
                "handedness" to handedness,
                "landmarks" to lmList
            ))
        }

        bitmap.recycle()
        return mapOf("hands" to handsData)
    }
}
