package com.novusactus.interveniens.ui

import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale

fun initialsOf(name: String): String {
    val parts = name.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
    return when {
        parts.isEmpty() -> "?"
        parts.size == 1 -> parts[0].take(2).uppercase(Locale.getDefault())
        else -> (parts.first().take(1) + parts.last().take(1)).uppercase(Locale.getDefault())
    }
}

private val dateFmt: DateTimeFormatter = DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM)

fun formatDate(instant: Instant?): String =
    instant?.atZone(ZoneId.systemDefault())?.toLocalDate()?.format(dateFmt) ?: "—"

fun relativeTime(instant: Instant?): String {
    if (instant == null) return ""
    val secs = Duration.between(instant, Instant.now()).seconds
    return when {
        secs < 0 -> "just now"
        secs < 60 -> "just now"
        secs < 3600 -> "${secs / 60}m ago"
        secs < 86_400 -> "${secs / 3600}h ago"
        secs < 604_800 -> "${secs / 86_400}d ago"
        else -> formatDate(instant)
    }
}
