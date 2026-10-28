package com.rajtewari.motion_web

import android.app.DownloadManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.widget.Toast
import androidx.core.app.NotificationCompat
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val CHANNEL = "com.rajtewari.motion_web/downloader"
    private val NOTIF_CHANNEL_ID = "motionw_download_channel"
    private var downloadReceiver: BroadcastReceiver? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        createNotificationChannel()

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            if (call.method == "downloadApk") {
                val url = call.argument<String>("url")
                val fileName = call.argument<String>("fileName") ?: "MotionW.apk"
                if (!url.isNullOrEmpty()) {
                    try {
                        startDownload(url, fileName)
                        result.success(true)
                    } catch (e: Exception) {
                        result.error("DOWNLOAD_ERROR", e.localizedMessage, null)
                    }
                } else {
                    result.error("INVALID_URL", "URL cannot be null or empty", null)
                }
            } else {
                result.notImplemented()
            }
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "MotionW Downloads"
            val descriptionText = "Notifications for MotionW APK downloads"
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(NOTIF_CHANNEL_ID, name, importance).apply {
                description = descriptionText
                enableVibration(true)
            }
            val notificationManager: NotificationManager =
                getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun startDownload(url: String, fileName: String) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // 1. Initial Notification: Download Starting
        val startNotif = NotificationCompat.Builder(this, NOTIF_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("MotionW APK")
            .setContentText("Downloading MotionW APK ($fileName)...")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()
        notificationManager.notify(1001, startNotif)

        Toast.makeText(this, "Downloading MotionW APK...", Toast.LENGTH_SHORT).show()

        // 2. Android DownloadManager Request
        val request = DownloadManager.Request(Uri.parse(url))
            .setTitle(fileName)
            .setDescription("MotionW Air Gesture Engine APK")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
            .setAllowedOverMetered(true)
            .setAllowedOverRoaming(true)

        val downloadManager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val downloadId = downloadManager.enqueue(request)

        // 3. Register Receiver for Download Completion Notification
        downloadReceiver?.let {
            try { unregisterReceiver(it) } catch (_: Exception) {}
        }

        downloadReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                val id = intent?.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1) ?: -1
                if (id == downloadId) {
                    val completeNotif = NotificationCompat.Builder(this@MainActivity, NOTIF_CHANNEL_ID)
                        .setSmallIcon(R.mipmap.ic_launcher)
                        .setContentTitle("MotionW APK Download Complete")
                        .setContentText("$fileName has been saved to Downloads.")
                        .setPriority(NotificationCompat.PRIORITY_HIGH)
                        .setAutoCancel(true)
                        .build()
                    notificationManager.notify(1002, completeNotif)
                    Toast.makeText(this@MainActivity, "Download Complete: $fileName", Toast.LENGTH_LONG).show()
                }
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(
                downloadReceiver,
                IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
                Context.RECEIVER_NOT_EXPORTED
            )
        } else {
            registerReceiver(downloadReceiver, IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE))
        }
    }

    override fun onDestroy() {
        downloadReceiver?.let {
            try { unregisterReceiver(it) } catch (_: Exception) {}
        }
        super.onDestroy()
    }
}
