package com.novusactus.interveniens.ui.leaderboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.novusactus.interveniens.data.LeaderboardRepository
import com.novusactus.interveniens.data.friendlyDbError
import com.novusactus.interveniens.data.models.LeaderboardEntry
import com.novusactus.interveniens.session.UserSession
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class LeaderboardUiState(
    val entries: List<LeaderboardEntry> = emptyList(),
    val loading: Boolean = false,
    val error: String? = null,
)

class LeaderboardViewModel : ViewModel() {
    private val repo = LeaderboardRepository()

    private val _state = MutableStateFlow(LeaderboardUiState())
    val state: StateFlow<LeaderboardUiState> = _state.asStateFlow()

    fun refresh() {
        val currentId = UserSession.currentUser?.id
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            try {
                val list = repo.topPlayers(currentId, limit = 100)
                _state.update { it.copy(entries = list, loading = false) }
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = friendlyDbError(e)) }
            }
        }
    }
}
