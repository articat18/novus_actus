package com.novusactus.interveniens.data

import com.novusactus.interveniens.data.models.User
import java.sql.Connection

class ProfileRepository {

    suspend fun getUser(id: Int): User? = Database.withConnection { conn -> fetch(conn, id) }

    suspend fun currentRank(id: Int): Int? = Database.withConnection { conn -> rankOf(conn, id) }

    suspend fun updateDisplayName(id: Int, name: String): User? {
        val clean = name.trim()
        require(clean.isNotEmpty()) { "Display name cannot be empty." }
        return Database.withConnection { conn ->
            conn.prepareStatement(
                "UPDATE users SET display_name = ? WHERE id = ? " +
                    "RETURNING id, email, display_name, score, created_at"
            ).use { st ->
                st.setString(1, clean)
                st.setInt(2, id)
                st.executeQuery().use { rs -> if (rs.next()) rs.toUser() else null }
            }
        }
    }

    /**
     * Adds [delta] points to the user and writes a notification row describing what
     * changed — a rank climb when they overtook someone, otherwise a points update.
     * The notification is what the app later surfaces to the system tray, so this is
     * the "work with the data to send notifications" path. Returns the refreshed user.
     */
    suspend fun addPoints(id: Int, delta: Int): User? = Database.withConnection { conn ->
        conn.autoCommit = false
        try {
            val oldRank = rankOf(conn, id)
            conn.prepareStatement("UPDATE users SET score = score + ? WHERE id = ?").use { st ->
                st.setInt(1, delta)
                st.setInt(2, id)
                st.executeUpdate()
            }
            val user = fetch(conn, id)
            if (user == null) {
                conn.rollback()
                return@withConnection null
            }
            val newRank = rankOf(conn, id)
            val (title, body) = if (oldRank != null && newRank != null && newRank < oldRank) {
                "You're climbing! 🚀" to
                    "You moved from #$oldRank to #$newRank with ${user.score} points."
            } else {
                "+$delta points ⭐" to
                    "Nice work, ${user.displayName}! You now have ${user.score} points."
            }
            conn.prepareStatement(
                "INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)"
            ).use { st ->
                st.setInt(1, id)
                st.setString(2, title)
                st.setString(3, body)
                st.executeUpdate()
            }
            conn.commit()
            user
        } catch (e: Exception) {
            runCatching { conn.rollback() }
            throw e
        } finally {
            conn.autoCommit = true
        }
    }

    private fun fetch(conn: Connection, id: Int): User? =
        conn.prepareStatement(
            "SELECT id, email, display_name, score, created_at FROM users WHERE id = ?"
        ).use { st ->
            st.setInt(1, id)
            st.executeQuery().use { rs -> if (rs.next()) rs.toUser() else null }
        }

    private fun rankOf(conn: Connection, id: Int): Int? =
        conn.prepareStatement(
            "SELECT rnk FROM (" +
                "SELECT id, RANK() OVER (ORDER BY score DESC, created_at ASC) AS rnk FROM users" +
                ") ranked WHERE id = ?"
        ).use { st ->
            st.setInt(1, id)
            st.executeQuery().use { rs -> if (rs.next()) rs.getInt("rnk") else null }
        }
}
