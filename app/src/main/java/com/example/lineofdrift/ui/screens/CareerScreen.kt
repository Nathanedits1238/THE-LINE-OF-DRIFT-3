package com.example.lineofdrift.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.lineofdrift.data.GameRepository

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CareerScreen(
    onBack: () -> Unit,
    onStartFreeRoam: () -> Unit
) {
    val profile by GameRepository.profile.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Carreira & Open World", fontWeight = FontWeight.Bold) },
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
                    Text(text = "Estatísticas de Carreira", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color(0xFFD4A24C))
                    Spacer(modifier = Modifier.height(12.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        CareerStatItem("Vitórias", profile.careerWins.toString())
                        CareerStatItem("Fugas", profile.totalEscapes.toString())
                        CareerStatItem("Policias", profile.copsDestroyed.toString())
                        CareerStatItem("Nível REP", profile.repLevel.toString())
                    }
                }
            }

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF111318)),
                border = BorderStroke(1.dp, Color(0xFF2D323E))
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(text = "Exploração Livre (Open World)", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color(0xFFD4A24C))
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(text = "Explore a cidade de Neo-Tokyo em mundo aberto. Encontre esconderijos, escape de patrulhas e ganhe reputação.", fontSize = 13.sp, color = Color(0xFF9CA3AF))
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(
                        onClick = onStartFreeRoam,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD4A24C), contentColor = Color(0xFF0B0C0F))
                    ) {
                        Icon(Icons.Default.Home, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Entrar no Open World")
                    }
                }
            }
        }
    }
}

@Composable
fun CareerStatItem(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = value, fontSize = 20.sp, fontWeight = FontWeight.Black, color = Color(0xFFEFEDE7))
        Text(text = label, fontSize = 11.sp, color = Color(0xFF9CA3AF))
    }
}
