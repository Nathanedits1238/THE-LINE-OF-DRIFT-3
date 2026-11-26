package com.example.lineofdrift.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
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
fun ChallengesScreen(
    onBack: () -> Unit
) {
    val challenges by GameRepository.challenges.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Desafios Extremos", fontWeight = FontWeight.Bold) },
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
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Text(
                    text = "Complete desafios de drift, fuga e alta velocidade para ganhar prêmios em dinheiro e reputação.",
                    fontSize = 14.sp,
                    color = Color(0xFF9CA3AF)
                )
            }
            items(challenges) { challenge ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF111318)),
                    border = BorderStroke(1.dp, Color(0xFF2D323E))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Star, contentDescription = null, tint = Color(0xFFD4A24C))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(text = challenge.title, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color(0xFFEFEDE7))
                            }
                            Text(text = "$${challenge.reward}", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color(0xFFE5B963))
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(text = challenge.description, fontSize = 13.sp, color = Color(0xFF9CA3AF))
                    }
                }
            }
        }
    }
}
