package com.novusactus.interveniens.data

/** Turns raw JDBC/connection exceptions into something a person can act on. */
internal fun friendlyDbError(e: Throwable): String {
    val msg = e.message ?: e.javaClass.simpleName
    return when {
        msg.contains("Connection refused", ignoreCase = true) ->
            "Can't reach the database at ${DbConfig.host}:${DbConfig.port}. Is Postgres running and reachable?"
        msg.contains("timeout", ignoreCase = true) ->
            "The database took too long to respond. Check DB_HOST and your network."
        msg.contains("password authentication", ignoreCase = true) ->
            "The database rejected DB_USER/DB_PASSWORD from local.properties."
        msg.contains("database", ignoreCase = true) && msg.contains("does not exist", ignoreCase = true) ->
            "Database \"${DbConfig.name}\" does not exist. Create it and run db/schema.sql."
        msg.contains("relation", ignoreCase = true) && msg.contains("does not exist", ignoreCase = true) ->
            "The tables are missing. Run db/schema.sql against your database."
        else -> "Database error: $msg"
    }
}
