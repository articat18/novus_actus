package com.novusactus.interveniens.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.novusactus.interveniens.notifications.NotificationPollWorker
import com.novusactus.interveniens.session.UserSession
import com.novusactus.interveniens.ui.auth.SignInScreen

/**
 * Top-level composable: shows the sign-in flow when nobody is signed in, and the main
 * tabbed app otherwise. Also wires up the notification permission and the background
 * poll that turns database rows into system notifications.
 */
@Composable
fun AppRoot() {
    val context = LocalContext.current
    val user by UserSession.user.collectAsStateWithLifecycle()

    NotificationPermissionEffect()

    LaunchedEffect(user?.id) {
        if (user?.id != null) {
            NotificationPollWorker.enqueuePeriodic(context)
            NotificationPollWorker.runNow(context)
        }
    }

    if (user == null) {
        SignInScreen()
    } else {
        MainScaffold()
    }
}

@Composable
private fun NotificationPermissionEffect() {
    val context = LocalContext.current
    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { /* granted or not — the app degrades gracefully either way */ }

    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                context, Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) launcher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }
}
