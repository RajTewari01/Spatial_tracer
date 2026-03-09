package com.rajtewari.spatial_tracer_mobile

import kotlin.math.sqrt

object FaceDetector {
    private var lastAction = "IDLE"
    private var actionCount = 0
    private const val STABLE_FRAMES = 4 

    data class Point(val x: Double, val y: Double)

    private fun dist(a: Point, b: Point): Double {
        return sqrt(Math.pow(a.x - b.x, 2.0) + Math.pow(a.y - b.y, 2.0))
    }

    fun detectAction(lmRaw: List<Map<String, Double>>): String {
        if (lmRaw.size < 400) return "IDLE"

        val lm = lmRaw.map { Point(it["x"] ?: 0.0, it["y"] ?: 0.0) }

        // Eye Aspect Ratio (EAR) for Blinking
        val leftEyeHeight = dist(lm[159], lm[145])
        val leftEyeWidth = dist(lm[33], lm[133])
        val leftEar = if (leftEyeWidth > 0) leftEyeHeight / leftEyeWidth else 0.0

        val rightEyeHeight = dist(lm[386], lm[374])
        val rightEyeWidth = dist(lm[362], lm[263])
        val rightEar = if (rightEyeWidth > 0) rightEyeHeight / rightEyeWidth else 0.0

        val ear = (leftEar + rightEar) / 2.0

        // Blink threshold loosened to 0.20 to capture blinks more easily
        if (ear < 0.20) {
            return stabilize("BLINK")
        }

        // --- 2D Geometry Tilts (More robust than Z-Depth for varying face structures) ---
        
        // PITCH (Up/Down) - Nose (1) relative to Forehead (10) and Chin (152)
        val faceHeight = dist(lm[10], lm[152])
        val noseToTop = dist(lm[1], lm[10])
        val pitchRatio = if (faceHeight > 0) noseToTop / faceHeight else 0.5
        
        // Neutral pitch ratio is usually ~0.45-0.55.
        // We require a significant tilt backward (< 0.35) or forward (> 0.65)
        if (pitchRatio < 0.35) return stabilize("TILT_UP")
        if (pitchRatio > 0.65) return stabilize("TILT_DOWN")

        // YAW (Left/Right) - Nose (1) relative to Left Cheek (234) and Right Cheek (454)
        val faceWidth = dist(lm[234], lm[454])
        val noseToLeft = dist(lm[1], lm[234])
        val yawRatio = if (faceWidth > 0) noseToLeft / faceWidth else 0.5
        
        // Neutral yaw ratio is ~0.50.
        // Require significant head turn.
        if (yawRatio < 0.25) return stabilize("TILT_LEFT")
        if (yawRatio > 0.75) return stabilize("TILT_RIGHT")

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
