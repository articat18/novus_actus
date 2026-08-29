package com.novusactus.interveniens.ui.auth

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.novusactus.interveniens.data.AuthOutcome
import com.novusactus.interveniens.data.AuthRepository
import com.novusactus.interveniens.session.UserSession
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class AuthUiState(
    val email: String = "",
    val password: String = "",
    val displayName: String = "",
    val isRegisterMode: Boolean = false,
    val loading: Boolean = false,
    val error: String? = null,
)

class AuthViewModel(app: Application) : AndroidViewModel(app) {
    private val repo = AuthRepository()

    private val _state = MutableStateFlow(AuthUiState())
    val state: StateFlow<AuthUiState> = _state.asStateFlow()

    fun onEmail(value: String) = _state.update { it.copy(email = value, error = null) }
    fun onPassword(value: String) = _state.update { it.copy(password = value, error = null) }
    fun onName(value: String) = _state.update { it.copy(displayName = value, error = null) }
    fun toggleMode() = _state.update {
        it.copy(isRegisterMode = !it.isRegisterMode, error = null)
    }

    fun submit() {
        val current = _state.value
        if (current.loading) return
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            val outcome = if (current.isRegisterMode) {
                repo.register(current.email, current.password, current.displayName)
            } else {
                repo.signIn(current.email, current.password)
            }
            when (outcome) {
                is AuthOutcome.Success -> {
                    UserSession.setUser(getApplication(), outcome.user)
                    _state.update { it.copy(loading = false) }
                }
                is AuthOutcome.Failure ->
                    _state.update { it.copy(loading = false, error = outcome.message) }
            }
        }
    }
}
