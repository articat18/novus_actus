package com.novusactus.interveniens.ui.profile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.novusactus.interveniens.data.ProfileRepository
import com.novusactus.interveniens.data.friendlyDbError
import com.novusactus.interveniens.notifications.NotificationPollWorker
import com.novusactus.interveniens.session.UserSession
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ProfileUiState(
    val rank: Int? = null,
    val working: Boolean = false,
    val message: String? = null,
    val error: String? = null,
)

class ProfileViewModel(app: Application) : AndroidViewModel(app) {
    private val repo = ProfileRepository()

    private val _state = MutableStateFlow(ProfileUiState())
    val state: StateFlow<ProfileUiState> = _state.asStateFlow()

    fun refresh() {
        val id = UserSession.currentUser?.id ?: return
        viewModelScope.launch {
            try {
                val fresh = repo.getUser(id)
                if (fresh != null) UserSession.setUser(getApplication(), fresh)
                val rank = repo.currentRank(id)
                _state.update { it.copy(rank = rank) }
            } catch (e: Exception) {
                _state.update { it.copy(error = friendlyDbError(e)) }
            }
        }
    }

    /** Simulates earning points: updates the DB, which writes a notification row, then
     *  asks the worker to push that row to the system tray right away. */
    fun addPoints(delta: Int) {
        val id = UserSession.currentUser?.id ?: return
        if (_state.value.working) return
        _state.update { it.copy(working = true, error = null, message = null) }
        viewModelScope.launch {
            try {
                val updated = repo.addPoints(id, delta)
                if (updated != null) UserSession.setUser(getApplication(), updated)
                val rank = repo.currentRank(id)
                NotificationPollWorker.runNow(getApplication())
                _state.update {
                    it.copy(working = false, rank = rank, message = "+$delta points added")
                }
            } catch (e: Exception) {
                _state.update { it.copy(working = false, error = friendlyDbError(e)) }
            }
        }
    }

    fun updateName(name: String) {
        val id = UserSession.currentUser?.id ?: return
        if (name.isBlank()) return
        viewModelScope.launch {
            try {
                val updated = repo.updateDisplayName(id, name)
                if (updated != null) {
                    UserSession.setUser(getApplication(), updated)
                    _state.update { it.copy(message = "Profile updated") }
                }
            } catch (e: Exception) {
                _state.update { it.copy(error = friendlyDbError(e)) }
            }
        }
    }

    fun consumeMessages() = _state.update { it.copy(message = null, error = null) }

    fun signOut() {
        NotificationPollWorker.cancel(getApplication())
        UserSession.signOut(getApplication())
    }
}
