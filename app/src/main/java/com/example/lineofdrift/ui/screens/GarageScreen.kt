package com.example.lineofdrift.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
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
fun GarageScreen(
    onBack: () -> Unit
) {
    val vehicles by GameRepository.vehicles.collectAsState()
    val profile by GameRepository.profile.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Garagem & Customização", fontWeight = FontWeight.Bold) },
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
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(text = "Seus Veículos de Elite", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color(0xFFD4A24C))
                    Text(text = "Caixa: $${profile.cash}", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color(0xFF48BB78))
                }
            }

            items(vehicles) { car ->
                val isSelected = car.id == profile.selectedCarId
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF111318)),
                    border = BorderStroke(1.dp, if (isSelected) Color(0xFFD4A24C) else Color(0xFF2D323E))
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
                                Text(text = car.name, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color(0xFFEFEDE7))
                            }
                            if (isSelected) {
                                Surface(
                                    shape = RoundedCornerShape(4.dp),
                                    color = Color(0xFFD4A24C).copy(alpha = 0.2f)
                                ) {
                                    Row(modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Default.Check, contentDescription = null, tint = Color(0xFFD4A24C), modifier = Modifier.size(12.dp))
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text(text = "SELECIONADO", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFFD4A24C))
                                    }
                                }
                            }
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(text = "Velocidade: ${car.topSpeed} km/h", fontSize = 12.sp, color = Color(0xFF9CA3AF))
                            Text(text = "Aceleração: ${car.acceleration}%", fontSize = 12.sp, color = Color(0xFF9CA3AF))
                            Text(text = "Handling: ${car.handling}%", fontSize = 12.sp, color = Color(0xFF9CA3AF))
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                        if (car.unlocked) {
                            if (!isSelected) {
                                Button(
                                    onClick = { GameRepository.selectCar(car.id) },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF171A22), contentColor = Color(0xFFD4A24C)),
                                    border = BorderStroke(1.dp, Color(0xFFD4A24C))
                                ) {
                                    Text("Selecionar Carro")
                                }
                            }
                        } else {
                            Button(
                                onClick = { GameRepository.unlockCar(car.id) },
                                modifier = Modifier.fillMaxWidth(),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD4A24C), contentColor = Color(0xFF0B0C0F))
                            ) {
                                Text("Comprar por $${car.price}")
                            }
                        }
                    }
                }
            }
        }
    }
}
