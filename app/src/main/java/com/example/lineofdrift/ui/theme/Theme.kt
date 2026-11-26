package com.example.lineofdrift.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFFD4A24C),
    onPrimary = Color(0xFF0B0C0F),
    secondary = Color(0xFFE5B963),
    onSecondary = Color(0xFF0B0C0F),
    background = Color(0xFF08090C),
    onBackground = Color(0xFFEFEDE7),
    surface = Color(0xFF111318),
    onSurface = Color(0xFFEFEDE7),
    error = Color(0xFFC53030),
    onError = Color(0xFFEFEDE7)
)

@Composable
fun TheLineOfDriftTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        content = content
    )
}
