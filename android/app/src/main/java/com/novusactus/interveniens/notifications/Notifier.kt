package com.novusactus.interveniens.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.novusactus.interveniens.R
import com.novusactus.interveniens.data.models.AppNotification

/** Posts data-driven notifications to the Android system tray. */
object Notifier {
    const val CHANNEL_ID = "novus_actus_updates"
    private const val CHANNEL_NAME = "Updates"

    fun ensureChannel(context: Context) {
        val channel = NotificationChannel(
            CHANNEL_ID,
            CHANNEL_NAME,
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply { description = "Leaderboard climbs and profile updates" }
        context.getSystemService(NotificationManager::class.java)
            ?.createNotificationChannel(channel)
    }

    fun canPost(context: Context): Boolean =
        NotificationManagerCompat.from(context).areNotificationsEnabled()

    fun show(context: Context, notification: AppNotification) {
        if (!canPost(context)) return
        val built = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_notify)
            .setContentTitle(notification.title)
            .setContentText(notification.body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(notification.body))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()
        try {
            NotificationManagerCompat.from(context).notify(notification.id, built)
        } catch (_: SecurityException) {
            // POST_NOTIFICATIONS was revoked between the check and the post; ignore.
        }
    }
}
