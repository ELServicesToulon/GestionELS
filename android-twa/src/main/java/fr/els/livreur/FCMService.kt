package fr.els.livreur

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class FCMService : FirebaseMessagingService() {
  private val client = OkHttpClient.Builder()
    .connectTimeout(10, TimeUnit.SECONDS)
    .readTimeout(10, TimeUnit.SECONDS)
    .build()

  override fun onCreate() {
    super.onCreate()
    ensureNotificationChannel()
  }

  override fun onNewToken(token: String) {
    super.onNewToken(token)
    val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
    val email = prefs.getString(KEY_DRIVER_EMAIL, null)
    if (!email.isNullOrBlank()) {
      registerToken(email, token)
    }
  }

  override fun onMessageReceived(remoteMessage: RemoteMessage) {
    super.onMessageReceived(remoteMessage)
    val data = remoteMessage.data
    val eventId = data["eventId"] ?: return
    val cmd = data["cmd"] ?: ""
    val driverEmail = data["driverEmail"]
    if (!driverEmail.isNullOrBlank()) {
      getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit().putString(KEY_DRIVER_EMAIL, driverEmail).apply()
    }
    val url = data["url"] ?: "https://DOMAIN/app/?eventId=$eventId&cmd=$cmd"

    val intent = Intent(this, TwaLauncherActivity::class.java).apply {
      addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
      putExtra(TwaLauncherActivity.EXTRA_EVENT_ID, eventId)
      putExtra(TwaLauncherActivity.EXTRA_CMD, cmd)
      data = Uri.parse(url)
    }

    val pendingIntent = PendingIntent.getActivity(
      this,
      eventId.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setContentTitle(remoteMessage.notification?.title ?: "Livraison")
      .setContentText(remoteMessage.notification?.body ?: "Nouvelle fiche")
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setAutoCancel(true)
      .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))
      .setContentIntent(pendingIntent)
      .build()

    with(NotificationManagerCompat.from(this)) {
      notify(eventId.hashCode(), notification)
    }
  }

  private fun ensureNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val name = "Notifications livraisons"
      val channel = NotificationChannel(CHANNEL_ID, name, NotificationManager.IMPORTANCE_HIGH)
      val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      manager.createNotificationChannel(channel)
    }
  }

  private fun registerToken(email: String, token: String) {
    val body = JSONObject().apply {
      put("driverEmail", email)
      put("token", token)
      put("platform", "android")
    }
    val request = Request.Builder()
      .url("WEB_APP_URL/api/registerDevice")
      .post(body.toString().toRequestBody("application/json".toMediaType()))
      .build()
    client.newCall(request).enqueue(object : okhttp3.Callback {
      override fun onFailure(call: okhttp3.Call, e: java.io.IOException) {
        // log debug
      }

      override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
        response.close()
      }
    })
  }

  companion object {
    const val PREFS_NAME = "livreur_prefs"
    const val KEY_DRIVER_EMAIL = "driver_email"
    const val CHANNEL_ID = "livraisons"
  }
}
