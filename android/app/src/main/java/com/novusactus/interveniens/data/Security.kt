package com.novusactus.interveniens.data

import java.security.MessageDigest

/**
 * Demo-only password hashing: salted SHA-256. This is NOT production-grade (a real
 * app should use a slow, memory-hard hash such as bcrypt/scrypt/Argon2 on a server).
 * It exists so passwords are not stored in plain text for this hackathon showcase.
 */
internal fun hashPassword(email: String, password: String): String {
    val md = MessageDigest.getInstance("SHA-256")
    val salted = "${email.lowercase()}::$password::novus_actus_v1"
    return md.digest(salted.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
}
