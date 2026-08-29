package com.novusactus.interveniens.data

import com.novusactus.interveniens.data.models.LeaderboardEntry

class LeaderboardRepository {

    suspend fun topPlayers(currentUserId: Int?, limit: Int = 100): List<LeaderboardEntry> =
        Database.withConnection { conn ->
            conn.prepareStatement(
                "SELECT id, display_name, score, " +
                    "RANK() OVER (ORDER BY score DESC, created_at ASC) AS rnk " +
                    "FROM users " +
                    "ORDER BY score DESC, created_at ASC " +
                    "LIMIT ?"
            ).use { st ->
                st.setInt(1, limit)
                st.executeQuery().use { rs ->
                    buildList {
                        while (rs.next()) {
                            val id = rs.getInt("id")
                            add(
                                LeaderboardEntry(
                                    rank = rs.getInt("rnk"),
                                    userId = id,
                                    displayName = rs.getString("display_name"),
                                    score = rs.getInt("score"),
                                    isCurrentUser = currentUserId != null && id == currentUserId
                                )
                            )
                        }
                    }
                }
            }
        }
}
