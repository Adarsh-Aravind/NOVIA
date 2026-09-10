package expo.modules.notificationlistener

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import org.json.JSONObject

/**
 * The primary source of detected payments: the bank's own SMS.
 *
 * Both partners bank with Kotak, and Kotak reports every UPI transfer by SMS
 * ("Sent Rs.20.00 from XX2946 to GAYATHRI UDAYAN on 07-Sep-26..."). That makes
 * SMS a better signal than the notification listener for this couple, in three
 * ways: it fires whether or not the messaging app's notifications are enabled,
 * it hands over the whole body rather than whatever a collapsed notification
 * happened to show, and RECEIVE_SMS is an ordinary runtime permission with a
 * one-tap dialog instead of a trip into Settings.
 *
 * The notification listener stays for payments an app announces but the bank
 * doesn't text about.
 */
class NoviaSmsReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context?, intent: Intent?) {
    if (context == null || intent == null) return
    if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

    val messages = try {
      Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
    } catch (e: Exception) {
      return
    }
    if (messages.isEmpty()) return

    // A long SMS arrives as several parts that only mean anything joined back
    // together — and a bank transaction message is reliably long enough to be
    // split. Group by sender so two messages landing at once don't merge.
    val bySender = LinkedHashMap<String, StringBuilder>()
    var postTime = 0L
    for (message in messages) {
      val sender = message.displayOriginatingAddress ?: message.originatingAddress ?: "SMS"
      bySender.getOrPut(sender) { StringBuilder() }.append(message.displayMessageBody ?: "")
      postTime = maxOf(postTime, message.timestampMillis)
    }

    for ((sender, builder) in bySender) {
      val body = builder.toString()
      if (!looksFinancial(body)) continue

      val entry = JSONObject().apply {
        // A synthetic package, so a message and a notification travel through
        // the same queue and are parsed by the same code in JS.
        put("packageName", SMS_PACKAGE)
        put("title", sender)
        put("text", body)
        put("postTime", if (postTime > 0) postTime else System.currentTimeMillis())
      }

      NotificationStore.append(context, entry)
      NotificationListenerModule.emit(entry)
    }
  }

  companion object {
    const val SMS_PACKAGE = "android.sms"

    /**
     * A privacy filter, not a parsing rule.
     *
     * RECEIVE_SMS hands this receiver every text the phone gets, including
     * one-time codes and whatever people write to each other. Requiring an
     * amount before anything is written to the queue keeps all of that out of
     * storage entirely, rather than queueing it and relying on the parser to
     * discard it later.
     *
     * Kept deliberately crude for the same reason the real patterns live in
     * JavaScript: anything subtle enough to be wrong belongs where it can be
     * fixed without a new build.
     */
    private val AMOUNT = Regex("""(?:rs\.?|inr|₹)\s?\d""", RegexOption.IGNORE_CASE)

    fun looksFinancial(body: String): Boolean = AMOUNT.containsMatchIn(body)
  }
}
