package com.novusactus.interveniens.session

import android.content.Context
import com.novusactus.interveniens.data.models.User
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.time.Instant

/**
 * Holds the signed-in user for the whole process and mirrors the essentials to
 * SharedPreferences, so a background worker (or a cold start) can still tell who is
 * logged in without hitting the database.
 */
object UserSession {
    private const val PREFS = "novus_session"
    private const val KEY_ID = "user_id"
    private const val KEY_EMAIL = "email"
    private const val KEY_NAME = "display_name"
    private const val KEY_SCORE = "score"
    private const val KEY_CREATED = "created_at"

    private val _user = MutableStateFlow<User?>(null)
    val user: StateFlow<User?> = _user.asStateFlow()

    val currentUser: User? get() = _user.value

    fun load(context: Context) {
        val p = prefs(context)
        val id = p.getInt(KEY_ID, -1)
        _user.value = if (id <= 0) null else User(
            id = id,
            email = p.getString(KEY_EMAIL, "").orEmpty(),
            displayName = p.getString(KEY_NAME, "").orEmpty(),
            score = p.getInt(KEY_SCORE, 0),
            createdAt = p.getLong(KEY_CREATED, 0L).takeIf { it > 0 }?.let(Instant::ofEpochMilli)
        )
    }

    fun setUser(context: Context, user: User) {
        prefs(context).edit()
            .putInt(KEY_ID, user.id)
            .putString(KEY_EMAIL, user.email)
            .putString(KEY_NAME, user.displayName)
            .putInt(KEY_SCORE, user.score)
            .putLong(KEY_CREATED, user.createdAt?.toEpochMilli() ?: 0L)
            .apply()
        _user.value = user
    }

    fun signOut(context: Context) {
        prefs(context).edit().clear().apply()
        _user.value = null
    }

    fun currentUserId(context: Context): Int? =
        prefs(context).getInt(KEY_ID, -1).takeIf { it > 0 }

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
