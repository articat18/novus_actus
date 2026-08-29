package com.novusactus.interveniens.data

import com.novusactus.interveniens.data.models.AppNotification
import com.novusactus.interveniens.data.models.User
import java.sql.ResultSet

internal fun ResultSet.toUser(): User = User(
    id = getInt("id"),
    email = getString("email"),
    displayName = getString("display_name"),
    score = getInt("score"),
    createdAt = getTimestamp("created_at")?.toInstant()
)

internal fun ResultSet.toNotification(): AppNotification = AppNotification(
    id = getInt("id"),
    userId = getInt("user_id"),
    title = getString("title"),
    body = getString("body"),
    isRead = getBoolean("is_read"),
    isDelivered = getBoolean("is_delivered"),
    createdAt = getTimestamp("created_at")?.toInstant()
)
