package com.novusactus.interveniens.data.models

import java.time.Instant

data class User(
    val id: Int,
    val email: String,
    val displayName: String,
    val score: Int,
    val createdAt: Instant?
)

data class LeaderboardEntry(
    val rank: Int,
    val userId: Int,
    val displayName: String,
    val score: Int,
    val isCurrentUser: Boolean
)

data class AppNotification(
    val id: Int,
    val userId: Int,
    val title: String,
    val body: String,
    val isRead: Boolean,
    val isDelivered: Boolean,
    val createdAt: Instant?
)
