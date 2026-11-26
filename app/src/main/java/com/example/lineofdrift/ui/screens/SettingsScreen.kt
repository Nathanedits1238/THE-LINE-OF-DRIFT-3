package com.example.lineofdrift.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onBack: () -> Unit
) {
    var soundVolume by remember { mutableStateOf(0.8f) }
    var gyroEnabled by remember { mutableStateOf(true) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Configurações", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Voltar", tint = Color(0xFFD4A24C))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFF111318), titleContentColor = Color(0xFFEFEDE7))
            )
        },
        containerColor = Color(0xFF08090C)
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF111318)),
                border = BorderStroke(1.dp, Color(0xFF2D323E))
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(text = "Áudio & Efeitos", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color(0xFFD4A24C))
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(text = "Volume Geral: ${(soundVolume * 100).toInt()}%", fontSize = 13.sp, color = Color(0xFFEFEDE7))
                    Slider(
                        value = soundVolume,
                        onValueChange = { soundVolume = it },
                        colors = SliderDefaults.colors(thumbColor = Color(0xFFD4A24C), activeTrackColor = Color(0xFFD4A24C))
                    )
                }
            }

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF111318)),
                border = BorderStroke(1.dp, Color(0xFF2D323E))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(text = "Direção por Giroscópio", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color(0xFFD4A24C))
                        Text(text = "Inclinar o celular para esterçar", fontSize = 12.sp, color = Color(0xFF9CA3AF))
                    }
                    Switch(
                        checked = gyroEnabled,
                        onCheckedChange = { gyroEnabled = it },
                        colors = SwitchDefaults.colors(checkedThumbColor = Color(0xFFD4A24C), checkedTrackColor = Color(0xFFD4A24C).copy(alpha = 0.5f))
                    )
                }
            }
        }
    }
}
