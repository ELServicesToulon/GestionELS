package fr.els.livreur

import android.content.Intent
import android.net.Uri
import com.google.androidbrowserhelper.trusted.LauncherActivity

class TwaLauncherActivity : LauncherActivity() {
  override fun getLaunchingUrl(intent: Intent): Uri {
    return buildUrl(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    launchTwa()
  }

  private fun buildUrl(intent: Intent): Uri {
    val baseUrl = "https://DOMAIN/app/"
    val eventId = intent.getStringExtra(EXTRA_EVENT_ID)
    val cmd = intent.getStringExtra(EXTRA_CMD)
    return if (!eventId.isNullOrBlank()) {
      Uri.parse(baseUrl).buildUpon()
        .appendQueryParameter("eventId", eventId)
        .appendQueryParameter("cmd", cmd ?: "")
        .appendQueryParameter("source", "twa")
        .build()
    } else {
      Uri.parse(baseUrl)
    }
  }

  override fun handleNonHttp(safeIntent: Intent?) {
    safeIntent?.let { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://DOMAIN"))) }
  }

  companion object {
    const val EXTRA_EVENT_ID = "eventId"
    const val EXTRA_CMD = "cmd"
  }
}
