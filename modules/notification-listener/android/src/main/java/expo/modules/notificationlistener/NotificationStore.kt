package expo.modules.notificationlistener

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

/**
 * The bridge between a service that runs whenever Android feels like it and a
 * JS runtime that mostly isn't running at all.
 *
 * A payment notification arrives while the app is closed far more often than
 * while it is open, so the service cannot simply emit an event and hope
 * somebody is listening. Everything it captures is appended here first; the JS
 * side drains the queue when it next comes to the foreground, and the live
 * event is only a fast path for the case where the app happens to be open.
 *
 * The queue holds raw notification text, which is why it is bounded, private to
 * the app's own storage, and cleared on drain. Nothing raw is ever uploaded —
 * the parser runs on the device and only its output reaches Supabase.
 */
internal object NotificationStore {
  private const val PREFS = "novia_notification_listener"
  private const val KEY_QUEUE = "pending"
  private const val KEY_PACKAGES = "watched_packages"

  /** Enough to survive a weekend of missed drains without growing unbounded. */
  private const val MAX_QUEUE = 200

  /**
   * The default watch list. It is overwritten from JS on every launch, so the
   * set of payment apps can change in an over-the-air update without a new
   * native build — which matters, because the alternative is shipping an APK
   * every time a bank renames a package.
   */
  private val DEFAULT_PACKAGES = setOf(
    "com.google.android.apps.nbu.paisa.user", // Google Pay (India)
    "com.phonepe.app",
    "net.one97.paytm",
    "com.paypal.android.p2pmobile"
  )

  private fun prefs(context: Context): SharedPreferences =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun watchedPackages(context: Context): Set<String> =
    prefs(context).getStringSet(KEY_PACKAGES, null) ?: DEFAULT_PACKAGES

  fun setWatchedPackages(context: Context, packages: List<String>) {
    // An empty list would silently watch nothing; treat it as "use the
    // defaults" rather than as a request to go deaf.
    val value = if (packages.isEmpty()) DEFAULT_PACKAGES else packages.toSet()
    prefs(context).edit().putStringSet(KEY_PACKAGES, value).apply()
  }

  fun isWatched(context: Context, packageName: String): Boolean =
    watchedPackages(context).contains(packageName)

  @Synchronized
  fun append(context: Context, entry: JSONObject) {
    val p = prefs(context)
    val queue = read(p)
    queue.put(entry)

    // Drop from the front once full: the newest notifications are the ones
    // still worth parsing.
    val trimmed = if (queue.length() > MAX_QUEUE) {
      JSONArray().also { out ->
        for (i in queue.length() - MAX_QUEUE until queue.length()) out.put(queue.get(i))
      }
    } else {
      queue
    }
    p.edit().putString(KEY_QUEUE, trimmed.toString()).apply()
  }

  /** Returns everything queued and empties the queue in the same step. */
  @Synchronized
  fun drain(context: Context): List<Map<String, Any>> {
    val p = prefs(context)
    val queue = read(p)
    p.edit().remove(KEY_QUEUE).apply()

    val out = ArrayList<Map<String, Any>>(queue.length())
    for (i in 0 until queue.length()) {
      val o = queue.optJSONObject(i) ?: continue
      out.add(
        mapOf(
          "packageName" to o.optString("packageName"),
          "title" to o.optString("title"),
          "text" to o.optString("text"),
          "postTime" to o.optLong("postTime")
        )
      )
    }
    return out
  }

  private fun read(p: SharedPreferences): JSONArray =
    try {
      JSONArray(p.getString(KEY_QUEUE, "[]") ?: "[]")
    } catch (e: Exception) {
      JSONArray()
    }
}
