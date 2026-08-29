package com.novusactus.interveniens.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.sql.Connection
import java.util.Properties

/**
 * Thin JDBC helper that talks to the external Postgres database directly.
 *
 * This is deliberately simple for a hackathon happy-path: it opens a short-lived
 * connection per unit of work on a background dispatcher. A production app would put
 * a REST/GraphQL backend in front of the database instead of shipping credentials in
 * the client and connecting straight from the device.
 */
object Database {
    // Android does not reliably run the JDBC ServiceLoader auto-registration, so we
    // hold a driver instance and call connect() on it directly rather than going
    // through DriverManager.
    private val driver by lazy { org.postgresql.Driver() }

    fun open(): Connection {
        val props = Properties().apply {
            setProperty("user", DbConfig.user)
            setProperty("password", DbConfig.password)
            setProperty("connectTimeout", "10")
            setProperty("socketTimeout", "30")
            setProperty("loginTimeout", "10")
            setProperty("ApplicationName", "NovusActusInterveniens")
            val ssl = DbConfig.sslmode.trim()
            if (ssl.isNotEmpty() && ssl != "disable") {
                setProperty("sslmode", ssl)
                // Managed databases often present certificates the device's trust store
                // does not know about. For a demo we accept them rather than bundling a
                // custom trust store.
                setProperty("sslfactory", "org.postgresql.ssl.NonValidatingFactory")
            }
        }
        return driver.connect(DbConfig.jdbcUrl, props)
            ?: error("PostgreSQL driver rejected JDBC URL: ${DbConfig.jdbcUrl}")
    }

    /** Runs [block] with a fresh connection on the IO dispatcher, always closing it. */
    suspend fun <T> withConnection(block: (Connection) -> T): T =
        withContext(Dispatchers.IO) { open().use(block) }
}
