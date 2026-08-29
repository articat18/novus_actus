package com.novusactus.interveniens.data

import com.novusactus.interveniens.data.models.AppNotification

class NotificationRepository {

    suspend fun list(userId: Int, limit: Int = 100): List<AppNotification> =
        Database.withConnection { conn ->
            conn.prepareStatement(
                "SELECT id, user_id, title, body, is_read, is_delivered, created_at " +
                    "FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?"
            ).use { st ->
                st.setInt(1, userId)
                st.setInt(2, limit)
                st.executeQuery().use { rs ->
                    buildList { while (rs.next()) add(rs.toNotification()) }
                }
            }
        }

    suspend fun unreadCount(userId: Int): Int = Database.withConnection { conn ->
        conn.prepareStatement(
            "SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = FALSE"
        ).use { st ->
            st.setInt(1, userId)
            st.executeQuery().use { rs -> if (rs.next()) rs.getInt(1) else 0 }
        }
    }

    /** Notifications that have not yet been pushed to the device's system tray. */
    suspend fun pendingDelivery(userId: Int): List<AppNotification> =
        Database.withConnection { conn ->
            conn.prepareStatement(
                "SELECT id, user_id, title, body, is_read, is_delivered, created_at " +
                    "FROM notifications WHERE user_id = ? AND is_delivered = FALSE " +
                    "ORDER BY created_at ASC, id ASC"
            ).use { st ->
                st.setInt(1, userId)
                st.executeQuery().use { rs ->
                    buildList { while (rs.next()) add(rs.toNotification()) }
                }
            }
        }

    suspend fun markDelivered(ids: List<Int>) {
        if (ids.isEmpty()) return
        Database.withConnection { conn ->
            val array = conn.createArrayOf("integer", ids.toTypedArray())
            conn.prepareStatement(
                "UPDATE notifications SET is_delivered = TRUE WHERE id = ANY(?)"
            ).use { st ->
                st.setArray(1, array)
                st.executeUpdate()
            }
        }
    }

    suspend fun markRead(id: Int) = Database.withConnection { conn ->
        conn.prepareStatement("UPDATE notifications SET is_read = TRUE WHERE id = ?").use { st ->
            st.setInt(1, id)
            st.executeUpdate()
        }
        Unit
    }

    suspend fun markAllRead(userId: Int) = Database.withConnection { conn ->
        conn.prepareStatement(
            "UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE"
        ).use { st ->
            st.setInt(1, userId)
            st.executeUpdate()
        }
        Unit
    }

    suspend fun create(userId: Int, title: String, body: String) = Database.withConnection { conn ->
        conn.prepareStatement(
            "INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)"
        ).use { st ->
            st.setInt(1, userId)
            st.setString(2, title)
            st.setString(3, body)
            st.executeUpdate()
        }
        Unit
    }
}
