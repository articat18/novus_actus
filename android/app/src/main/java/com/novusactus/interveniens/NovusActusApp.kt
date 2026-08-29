package com.novusactus.interveniens

import android.app.Application
import com.novusactus.interveniens.notifications.Notifier
import com.novusactus.interveniens.session.UserSession

class NovusActusApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Notifier.ensureChannel(this)
        UserSession.load(this)
    }
}
