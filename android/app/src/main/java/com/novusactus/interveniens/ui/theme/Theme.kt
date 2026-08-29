package com.novusactus.interveniens.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    primary = Indigo,
    onPrimary = Color.White,
    primaryContainer = IndigoContainer,
    onPrimaryContainer = IndigoOnContainer,
    secondary = Teal,
    onSecondary = Color.White,
    tertiary = Amber,
    onTertiary = Color(0xFF3A2400),
    background = SurfaceLight,
    onBackground = Color(0xFF1B1B1F),
    surface = SurfaceLight,
    onSurface = Color(0xFF1B1B1F),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFFC3BCFF),
    onPrimary = Color(0xFF1B0087),
    primaryContainer = IndigoDark,
    onPrimaryContainer = Color(0xFFE5E1FF),
    secondary = Color(0xFF5CD6C8),
    onSecondary = Color(0xFF00382F),
    tertiary = Amber,
    onTertiary = Color(0xFF3A2400),
    background = SurfaceDark,
    onBackground = Color(0xFFE5E1E9),
    surface = SurfaceDark,
    onSurface = Color(0xFFE5E1E9),
)

@Composable
fun NovusActusTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = NovusTypography,
        content = content
    )
}
