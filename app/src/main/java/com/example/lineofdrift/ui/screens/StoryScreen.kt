package com.example.lineofdrift.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.PlayArrow
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
fun StoryScreen(
    onBack: () -> Unit,
    onStartChapter: (Int) -> Unit
) {
    val chapters by GameRepository.chapters.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Modo História (Luca & Miguel)", fontWeight = FontWeight.Bold) },
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
                    text = "Acompanhe a saga clandestina de Luca & Miguel pelas ruas de Neo-Tokyo e as perseguições implacáveis da polícia.",
                    fontSize = 14.sp,
                    color = Color(0xFF9CA3AF)
                )
            }
            items(chapters) { chapter ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF111318)),
                    border = BorderStroke(1.dp, Color(0xFF2D323E))
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = chapter.title,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFFD4A24C)
                            )
                            Surface(
                                shape = RoundedCornerShape(4.dp),
                                color = if (chapter.unlocked) Color(0xFF2F855A).copy(alpha = 0.2f) else Color(0xFF718096).copy(alpha = 0.2f)
                            ) {
                                Text(
                                    text = if (chapter.unlocked) "DISPONÍVEL" else "BLOQUEADO",
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (chapter.unlocked) Color(0xFF48BB78) else Color(0xFFA0AEC0)
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = chapter.subtitle,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Color(0xFFEFEDE7)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = chapter.briefing,
                            fontSize = 12.sp,
                            color = Color(0xFF9CA3AF)
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Divider(color = Color(0xFF2D323E))
                        Spacer(modifier = Modifier.height(12.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(text = "Recompensa:", fontSize = 11.sp, color = Color(0xFF9CA3AF))
                                Text(text = "$${chapter.rewardCash} + ${chapter.rewardRep} REP", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color(0xFFE5B963))
                            }
                            Button(
                                onClick = { onStartChapter(chapter.id) },
                                enabled = chapter.unlocked,
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD4A24C), contentColor = Color(0xFF0B0C0F))
                            ) {
                                Icon(Icons.Default.PlayArrow, contentDescription = null)
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Iniciar Capítulo")
                            }
                        }
                    }
                }
            }
        }
    }
}
