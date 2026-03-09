package com.rajtewari.spatial_tracer_mobile

import kotlin.math.sqrt

object FaceDetector {
    private var lastAction = "IDLE"
    private var actionCount = 0
    private const val STABLE_FRAMES = 3 // Standard stability for face tracking

    data class Point(val x: Double, val y: Double)

    private fun dist(a: Point, b: Point): Double {
        return sqrt(Math.pow(a.x - b.x, 2.0) + Math.pow(a.y - b.y, 2.0))
    }

    fun detectAction(lmRaw: List<Map<String, Double>>): String {
        // FaceLandmarker outputs 478 points
        if (lmRaw.size < 400) return "IDLE"

        val lm = lmRaw.map { Point(it["x"] ?: 0.0, it["y"] ?: 0.0) }

        // Eye Aspect Ratio (EAR) for Blinking
        // Left eye: Top 159, Bottom 145. Corners 33, 133
        val leftEyeHeight = dist(lm[159], lm[145])
        val leftEyeWidth = dist(lm[33], lm[133])
        val leftEar = if (leftEyeWidth > 0) leftEyeHeight / leftEyeWidth else 0.0

        // Right eye: Top 386, Bottom 374. Corners 362, 263
        val rightEyeHeight = dist(lm[386], lm[374])
        val rightEyeWidth = dist(lm[362], lm[263])
        val rightEar = if (rightEyeWidth > 0) rightEyeHeight / rightEyeWidth else 0.0

        val ear = (leftEar + rightEar) / 2.0

        // Blink threshold
        if (ear < 0.18) {
            return stabilize("BLINK")
        }

        // Head tilt UP/DOWN
        // Top of face 10, Bottom 152, Nose 1
        val faceHeight = dist(lm[10], lm[152])
        val noseToTop = dist(lm[1], lm[10])
        val noseRatioY = if (faceHeight > 0) noseToTop / faceHeight else 0.5

        if (noseRatioY > 0.65) return stabilize("TILT_DOWN") // Nose is closer to chin
        if (noseRatioY < 0.40) return stabilize("TILT_UP") // Nose closer to forehead

        // Head tilt LEFT/RIGHT
        // Left side 234, Right side 454
        val faceWidth = dist(lm[234], lm[454])
        val noseToLeft = dist(lm[1], lm[234])
        val noseRatioX = if (faceWidth > 0) noseToLeft / faceWidth else 0.5

        if (noseRatioX > 0.65) return stabilize("TILT_RIGHT")
        if (noseRatioX < 0.35) return stabilize("TILT_LEFT")

        return stabilize("IDLE")
    }

    private fun stabilize(action: String): String {
        if (action == lastAction) {
            actionCount++
        } else {
            actionCount = 1
            lastAction = action
        }
        return if (actionCount >= STABLE_FRAMES) action else "IDLE"
    }

    fun reset() {
        lastAction = "IDLE"
        actionCount = 0
    }
}
