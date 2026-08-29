package com.novusactus.interveniens.ui.notifications

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.novusactus.interveniens.data.NotificationRepository
import com.novusactus.interveniens.data.friendlyDbError
import com.novusactus.interveniens.data.models.AppNotification
import com.novusactus.interveniens.notifications.Notifier
import com.novusactus.interveniens.session.UserSession
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class NotificationsUiState(
    val items: List<AppNotification> = emptyList(),
    val loading: Boolean = false,
    val error: String? = null,
)

class NotificationsViewModel(app: Application) : AndroidViewModel(app) {
    private val repo = NotificationRepository()

    private val _state = MutableStateFlow(NotificationsUiState())
    val state: StateFlow<NotificationsUiState> = _state.asStateFlow()

    fun refresh() {
        val id = UserSession.currentUser?.id ?: return
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            try {
                // Push anything not yet delivered to the system tray while we load.
                val pending = repo.pendingDelivery(id)
                pending.forEach { Notifier.show(getApplication(), it) }
                if (pending.isNotEmpty()) repo.markDelivered(pending.map { it.id })

                val items = repo.list(id, limit = 100)
                _state.update { it.copy(items = items, loading = false) }
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = friendlyDbError(e)) }
            }
        }
    }

    fun markAllRead() {
        val id = UserSession.currentUser?.id ?: return
        viewModelScope.launch {
            try {
                repo.markAllRead(id)
                _state.update { s -> s.copy(items = s.items.map { it.copy(isRead = true) }) }
            } catch (e: Exception) {
                _state.update { it.copy(error = friendlyDbError(e)) }
            }
        }
    }
}
