package com.novusactus.interveniens.data

import com.novusactus.interveniens.BuildConfig

/**
 * Connection settings for the external Postgres database.
 *
 * Values are injected at build time from `local.properties` (or environment
 * variables) into [BuildConfig]. Edit `android/local.properties` to point the app
 * at your database — see `local.properties.example`.
 */
object DbConfig {
    val host: String get() = BuildConfig.DB_HOST
    val port: String get() = BuildConfig.DB_PORT
    val name: String get() = BuildConfig.DB_NAME
    val user: String get() = BuildConfig.DB_USER
    val password: String get() = BuildConfig.DB_PASSWORD
    val sslmode: String get() = BuildConfig.DB_SSLMODE

    val jdbcUrl: String get() = "jdbc:postgresql://$host:$port/$name"
}
