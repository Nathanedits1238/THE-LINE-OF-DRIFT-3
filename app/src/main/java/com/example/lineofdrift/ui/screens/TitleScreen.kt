package com.example.lineofdrift.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun TitleScreen(
    onNavigate: (String) -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.radialGradient(
                    colors = listOf(Color(0xFF14161D), Color(0xFF07080A)),
                    radius = 1200f
                )
            )
            .padding(24.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .systemBarsPadding(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = Color(0xFFD4A24C).copy(alpha = 0.15f),
                    border = BorderStroke(1.dp, Color(0xFFD4A24C).copy(alpha = 0.5f))
                ) {
                    Text(
                        text = "GRAND PROVED IT MOTOR 3D",
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                        color = Color(0xFFE5B963),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 2.sp
                    )
                }
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = "THE LINE OF DRIFT",
                    fontSize = 36.sp,
                    fontWeight = FontWeight.Black,
                    color = Color(0xFFF4F1EA),
                    letterSpacing = 1.sp
                )
                Text(
                    text = "O melhor jogo de Drift e perseguição policial",
                    fontSize = 13.sp,
                    color = Color(0xFF9CA3AF)
                )
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .widthIn(max = 420.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                MenuButton(
                    title = "Jogar Agora (Arcade / Perseguição)",
                    icon = Icons.Default.PlayArrow,
                    isPrimary = true,
                    onClick = { onNavigate("gameplay") }
                )
                MenuButton(
                    title = "Modo História (Luca & Miguel)",
                    icon = Icons.Default.Info,
                    onClick = { onNavigate("story") }
                )
                MenuButton(
                    title = "Carreira & Open World",
                    icon = Icons.Default.LocationOn,
                    onClick = { onNavigate("career") }
                )
                MenuButton(
                    title = "Garagem & Customização",
                    icon = Icons.Default.Person,
                    onClick = { onNavigate("garage") }
                )
                MenuButton(
                    title = "Multiplayer (Salas 4 Dígitos)",
                    icon = Icons.Default.Person,
                    onClick = { onNavigate("multiplayer") }
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Box(modifier = Modifier.weight(1f)) {
                        MenuButton(
                            title = "Desafios",
                            icon = Icons.Default.Star,
                            onClick = { onNavigate("challenges") }
                        )
                    }
                    Box(modifier = Modifier.weight(1f)) {
                        MenuButton(
                            title = "Ranking",
                            icon = Icons.Default.Star,
                            onClick = { onNavigate("leaderboard") }
                        )
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                TextButton(onClick = { onNavigate("achievements") }) {
                    Icon(Icons.Default.Star, contentDescription = null, tint = Color(0xFFD4A24C))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Conquistas", color = Color(0xFFEFEDE7))
                }
                TextButton(onClick = { onNavigate("settings") }) {
                    Icon(Icons.Default.Settings, contentDescription = null, tint = Color(0xFFD4A24C))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Configurações", color = Color(0xFFEFEDE7))
                }
            }
        }
    }
}

@Composable
fun MenuButton(
    title: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    isPrimary: Boolean = false,
    onClick: () -> Unit
) {
    Button(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .height(52.dp),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = if (isPrimary) Color(0xFFD4A24C) else Color(0xFF171A22),
            contentColor = if (isPrimary) Color(0xFF0B0C0F) else Color(0xFFEFEDE7)
        ),
        border = if (isPrimary) null else BorderStroke(1.dp, Color(0xFF2D323E))
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Start
        ) {
            Icon(icon, contentDescription = null, tint = if (isPrimary) Color(0xFF0B0C0F) else Color(0xFFD4A24C))
            Spacer(modifier = Modifier.width(16.dp))
            Text(
                text = title,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }
}
