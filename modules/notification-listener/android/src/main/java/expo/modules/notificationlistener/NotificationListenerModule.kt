package expo.modules.notificationlistener

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

class NotificationListenerModule : Module() {

  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is not available" }

  override fun definition() = ModuleDefinition {
    Name("NoviaNotificationListener")

    Events("onNotification")

    OnCreate { live = this@NotificationListenerModule }
    OnDestroy { if (live === this@NotificationListenerModule) live = null }

    /**
     * Notification access is not a runtime permission — there is no dialog to
     * request, and the only way to know whether we have it is to read the OS's
     * own list of enabled listeners and look for ourselves in it.
     */
    Function("isPermissionGranted") {
      val enabled = Settings.Secure.getString(
        context.contentResolver,
        "enabled_notification_listeners"
      ) ?: return@Function false

      enabled.split(":").any { flat ->
        ComponentName.unflattenFromString(flat)?.packageName == context.packageName
      }
    }

    /** Opens the system screen where the user toggles that access on. */
    Function("openSettings") {
      val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    Function("setWatchedPackages") { packages: List<String> ->
      NotificationStore.setWatchedPackages(context, packages)
    }

    Function("getWatchedPackages") {
      NotificationStore.watchedPackages(context).toList()
    }

    /** Everything captured while JS wasn't listening. Empties the queue. */
    Function("drainPending") {
      NotificationStore.drain(context)
    }

    /**
     * The reliability half of the feature. Samsung's "put unused apps to
     * sleep" will deep-sleep the app after a few idle days and stop delivery
     * with no error surfaced anywhere; a battery exemption is what prevents it.
     */
    Function("isIgnoringBatteryOptimizations") {
      val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        ?: return@Function false
      pm.isIgnoringBatteryOptimizations(context.packageName)
    }

    Function("requestIgnoreBatteryOptimizations") {
      // The direct request needs REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, which
      // Play Store policy restricts — irrelevant for a sideloaded build, but
      // fall back to the settings list if an OEM refuses the intent anyway.
      try {
        val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
          .setData(Uri.parse("package:" + context.packageName))
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
      } catch (e: Exception) {
        val fallback = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(fallback)
      }
    }
  }

  companion object {
    /**
     * The service is created by the OS and knows nothing about the module
     * instance, so the module registers itself here once the JS runtime comes
     * up. This is null most of the time — that is the normal case rather than
     * an error, and the queue in NotificationStore is what makes it survivable.
     */
    private var live: NotificationListenerModule? = null

    fun emit(entry: JSONObject) {
      val module = live ?: return
      try {
        module.sendEvent(
          "onNotification",
          mapOf(
            "packageName" to entry.optString("packageName"),
            "title" to entry.optString("title"),
            "text" to entry.optString("text"),
            "postTime" to entry.optLong("postTime")
          )
        )
      } catch (e: Exception) {
        // JS went away between the null check and the send. The entry is
        // already queued, so it arrives on the next drain instead.
      }
    }
  }
}
