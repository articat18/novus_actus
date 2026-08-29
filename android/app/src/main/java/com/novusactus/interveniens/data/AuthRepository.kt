package com.novusactus.interveniens.data

import com.novusactus.interveniens.data.models.User
import java.sql.SQLException

sealed interface AuthOutcome {
    data class Success(val user: User) : AuthOutcome
    data class Failure(val message: String) : AuthOutcome
}

class AuthRepository {

    suspend fun signIn(email: String, password: String): AuthOutcome {
        val cleanEmail = email.trim()
        if (cleanEmail.isEmpty() || password.isEmpty()) {
            return AuthOutcome.Failure("Enter your email and password.")
        }
        return try {
            Database.withConnection { conn ->
                conn.prepareStatement(
                    "SELECT id, email, display_name, score, created_at, password_hash " +
                        "FROM users WHERE lower(email) = lower(?)"
                ).use { st ->
                    st.setString(1, cleanEmail)
                    st.executeQuery().use { rs ->
                        when {
                            !rs.next() -> AuthOutcome.Failure("No account found for that email.")
                            rs.getString("password_hash") != hashPassword(cleanEmail, password) ->
                                AuthOutcome.Failure("Incorrect password.")
                            else -> AuthOutcome.Success(rs.toUser())
                        }
                    }
                }
            }
        } catch (e: Exception) {
            AuthOutcome.Failure(friendlyDbError(e))
        }
    }

    suspend fun register(email: String, password: String, displayName: String): AuthOutcome {
        val cleanEmail = email.trim()
        val cleanName = displayName.trim()
        if (cleanEmail.isEmpty() || password.isEmpty() || cleanName.isEmpty()) {
            return AuthOutcome.Failure("Fill in every field to create your profile.")
        }
        if (!cleanEmail.contains("@")) {
            return AuthOutcome.Failure("Enter a valid email address.")
        }
        if (password.length < 4) {
            return AuthOutcome.Failure("Use a password of at least 4 characters.")
        }
        return try {
            Database.withConnection { conn ->
                val user = conn.prepareStatement(
                    "INSERT INTO users (email, password_hash, display_name, score) " +
                        "VALUES (?, ?, ?, 0) " +
                        "RETURNING id, email, display_name, score, created_at"
                ).use { st ->
                    st.setString(1, cleanEmail)
                    st.setString(2, hashPassword(cleanEmail, password))
                    st.setString(3, cleanName)
                    st.executeQuery().use { rs ->
                        rs.next()
                        rs.toUser()
                    }
                }
                // Greet the new user with a data-backed notification row.
                conn.prepareStatement(
                    "INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)"
                ).use { st ->
                    st.setInt(1, user.id)
                    st.setString(2, "Welcome to Novus Actus 🎉")
                    st.setString(
                        3,
                        "Your profile is ready, ${user.displayName}. Earn points to climb the leaderboard!"
                    )
                    st.executeUpdate()
                }
                AuthOutcome.Success(user)
            }
        } catch (e: SQLException) {
            if (e.sqlState == "23505") {
                AuthOutcome.Failure("That email is already registered — try signing in.")
            } else {
                AuthOutcome.Failure(friendlyDbError(e))
            }
        } catch (e: Exception) {
            AuthOutcome.Failure(friendlyDbError(e))
        }
    }
}
