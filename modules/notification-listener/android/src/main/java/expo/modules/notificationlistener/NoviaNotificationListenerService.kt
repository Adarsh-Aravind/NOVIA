package expo.modules.notificationlistener

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONObject

/**
 * Captures notifications from the payment apps and hands them on for parsing.
 *
 * Deliberately dumb: it extracts title and text and does no matching of its
 * own. Every rule about what counts as a payment lives in JavaScript, so the
 * patterns can be corrected over the air — which they will need to be, since
 * payment apps reword their notifications without warning, and getting that
 * wrong here would mean shipping a whole native build to fix a string.
 */
class NoviaNotificationListenerService : NotificationListenerService() {

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    val notification = sbn ?: return
    val packageName = notification.packageName ?: return
    if (!NotificationStore.isWatched(this, packageName)) return

    val extras = notification.notification?.extras ?: return
    val title = extras.getCharSequence("android.title")?.toString().orEmpty()
    // bigText carries the full line when the collapsed text is elided; take
    // whichever is longer rather than assuming one is always present.
    val text = extras.getCharSequence("android.text")?.toString().orEmpty()
    val bigText = extras.getCharSequence("android.bigText")?.toString().orEmpty()
    val body = if (bigText.length > text.length) bigText else text

    if (title.isEmpty() && body.isEmpty()) return

    val entry = JSONObject().apply {
      put("packageName", packageName)
      put("title", title)
      put("text", body)
      put("postTime", notification.postTime)
    }

    NotificationStore.append(this, entry)
    NotificationListenerModule.emit(entry)
  }
}
