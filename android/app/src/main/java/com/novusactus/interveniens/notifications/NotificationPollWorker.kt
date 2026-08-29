package com.novusactus.interveniens.notifications

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.novusactus.interveniens.data.NotificationRepository
import com.novusactus.interveniens.session.UserSession
import java.util.concurrent.TimeUnit

/**
 * Reads the database for notification rows that have not yet been shown to the user and
 * pushes each one to the system tray, then marks it delivered. Runs periodically in the
 * background and can also be kicked off immediately after a data change.
 */
class NotificationPollWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val userId = UserSession.currentUserId(applicationContext) ?: return Result.success()
        return try {
            val repo = NotificationRepository()
            val pending = repo.pendingDelivery(userId)
            pending.forEach { Notifier.show(applicationContext, it) }
            repo.markDelivered(pending.map { it.id })
            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }

    companion object {
        private const val PERIODIC = "novus_notification_poll"
        private const val ONE_SHOT = "novus_notification_poll_now"

        private val networkConstraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        fun enqueuePeriodic(context: Context) {
            val request = PeriodicWorkRequestBuilder<NotificationPollWorker>(15, TimeUnit.MINUTES)
                .setConstraints(networkConstraints)
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                PERIODIC, ExistingPeriodicWorkPolicy.KEEP, request
            )
        }

        /** Deliver pending notifications right now (e.g. just after the user earned points). */
        fun runNow(context: Context) {
            val request = OneTimeWorkRequestBuilder<NotificationPollWorker>()
                .setConstraints(networkConstraints)
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork(
                ONE_SHOT, ExistingWorkPolicy.REPLACE, request
            )
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(PERIODIC)
        }
    }
}
