package com.rajtewari.spatial_tracer_mobile

import kotlin.math.sqrt

object FaceDetector {
    private var lastAction = "IDLE"
    private var actionCount = 0
    private const val STABLE_FRAMES = 4 // Increased slightly for stability to avoid jitter

    data class Point(val x: Double, val y: Double, val z: Double = 0.0)

    private fun dist(a: Point, b: Point): Double {
        return sqrt(Math.pow(a.x - b.x, 2.0) + Math.pow(a.y - b.y, 2.0))
    }

    fun detectAction(lmRaw: List<Map<String, Double>>): String {
        // FaceLandmarker outputs 478 points
        if (lmRaw.size < 400) return "IDLE"

        val lm = lmRaw.map { Point(it["x"] ?: 0.0, it["y"] ?: 0.0, it["z"] ?: 0.0) }

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
        if (ear < 0.17) {
            return stabilize("BLINK")
        }

        // Head tilt UP/DOWN (Using 3D Z-Depth)
        // Top of forehead (10), Chin (152)
        // In MediaPipe, smaller Z is closer to the camera.
        val foreheadZ = lm[10].z
        val chinZ = lm[152].z
        val pitchDelta = chinZ - foreheadZ 
        
        // If chin is much CLOSER (-) than forehead (+), head is tilted UP
        if (pitchDelta < -0.04) return stabilize("TILT_UP")
        // If forehead is much CLOSER (-) than chin (+), head is tilted DOWN
        if (pitchDelta > 0.035) return stabilize("TILT_DOWN")

        // Head tilt LEFT/RIGHT (Using 3D Z-Depth)
        // Left cheek (234), Right cheek (454) -- Note: Left side of image vs left side of face
        val leftCheekZ = lm[234].z
        val rightCheekZ = lm[454].z
        val yawDelta = rightCheekZ - leftCheekZ
        
        // If right cheek is further away (+) and left cheek is closer (-), head is turned to the user's right
        if (yawDelta > 0.04) return stabilize("TILT_RIGHT")
        // If left cheek is further away (+) and right cheek is closer (-), head is turned to the user's left
        if (yawDelta < -0.04) return stabilize("TILT_LEFT")

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
