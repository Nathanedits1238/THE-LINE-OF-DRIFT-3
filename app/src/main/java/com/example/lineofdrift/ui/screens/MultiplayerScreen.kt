package com.example.lineofdrift.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Person
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
fun MultiplayerScreen(
    onBack: () -> Unit,
    onJoinRoom: (String) -> Unit
) {
    var roomCodeInput by remember { mutableStateOf("") }
    var inLobby by remember { mutableStateOf(false) }
    var activeRoomCode by remember { mutableStateOf("") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Multiplayer (Salas 4 Dígitos)", fontWeight = FontWeight.Bold) },
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
            verticalArrangement = Arrangement.spacedBy(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            if (!inLobby) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF111318)),
                    border = BorderStroke(1.dp, Color(0xFF2D323E))
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(Icons.Default.Person, contentDescription = null, tint = Color(0xFFD4A24C), modifier = Modifier.size(48.dp))
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(text = "Entrar com Código de 4 Dígitos", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color(0xFFEFEDE7))
                        Spacer(modifier = Modifier.height(16.dp))
                        OutlinedTextField(
                            value = roomCodeInput,
                            onValueChange = { if (it.length <= 4) roomCodeInput = it },
                            label = { Text("Código da Sala (Ex: 4829)") },
                            singleLine = true,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Color(0xFFD4A24C),
                                unfocusedBorderColor = Color(0xFF2D323E),
                                focusedLabelColor = Color(0xFFD4A24C)
                            ),
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(
                            onClick = {
                                if (roomCodeInput.length == 4) {
                                    activeRoomCode = roomCodeInput
                                    inLobby = true
                                }
                            },
                            enabled = roomCodeInput.length == 4,
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD4A24C), contentColor = Color(0xFF0B0C0F))
                        ) {
                            Text("Entrar na Sala")
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                        OutlinedButton(
                            onClick = {
                                activeRoomCode = (1000..9999).random().toString()
                                inLobby = true
                            },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFD4A24C)),
                            border = BorderStroke(1.dp, Color(0xFFD4A24C))
                        ) {
                            Text("Criar Nova Sala Online")
                        }
                    }
                }
            } else {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF111318)),
                    border = BorderStroke(1.dp, Color(0xFF2D323E))
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(text = "Sala Ativa: $activeRoomCode", fontSize = 20.sp, fontWeight = FontWeight.Black, color = Color(0xFFD4A24C))
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(text = "Aguardando pilotos conectados...", fontSize = 13.sp, color = Color(0xFF9CA3AF))
                        Spacer(modifier = Modifier.height(20.dp))
                        Button(
                            onClick = { onJoinRoom(activeRoomCode) },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD4A24C), contentColor = Color(0xFF0B0C0F))
                        ) {
                            Text("Iniciar Corrida Multiplayer")
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        TextButton(onClick = { inLobby = false }) {
                            Text("Sair da Sala", color = Color(0xFFC53030))
                        }
                    }
                }
            }
        }
    }
}
