package com.example.lineofdrift.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

@Composable
fun GamePlayScreen(
    onExit: () -> Unit
) {
    var speed by remember { mutableStateOf(120f) }
    var driftScore by remember { mutableStateOf(0) }
    var heatLevel by remember { mutableStateOf(2) }
    var timeElapsed by remember { mutableStateOf(0) }
    var isNitroActive by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        while (true) {
            delay(1000L)
            timeElapsed++
            if (speed > 50f) {
                driftScore += (speed / 10).toInt()
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF07080A))
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val canvasWidth = size.width
            val canvasHeight = size.height

            drawRect(color = Color(0xFF111318), size = size)

            drawLine(
                color = Color(0xFFD4A24C).copy(alpha = 0.4f),
                start = Offset(canvasWidth * 0.3f, 0f),
                end = Offset(canvasWidth * 0.3f, canvasHeight),
                strokeWidth = 6f
            )
            drawLine(
                color = Color(0xFFD4A24C).copy(alpha = 0.4f),
                start = Offset(canvasWidth * 0.7f, 0f),
                end = Offset(canvasWidth * 0.7f, canvasHeight),
                strokeWidth = 6f
            )

            val carX = canvasWidth / 2f
            val carY = canvasHeight * 0.65f
            drawRect(
                color = Color(0xFFD4A24C),
                topLeft = Offset(carX - 30f, carY - 60f),
                size = androidx.compose.ui.geometry.Size(60f, 120f)
            )
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .systemBarsPadding()
                .padding(16.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = Color(0xFF111318).copy(alpha = 0.9f),
                    border = BorderStroke(1.dp, Color(0xFF2D323E))
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.Info, contentDescription = null, tint = Color(0xFF3182CE))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(text = "HEAT LVL $heatLevel", fontWeight = FontWeight.Bold, color = Color(0xFF3182CE), fontSize = 13.sp)
                    }
                }

                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = Color(0xFF111318).copy(alpha = 0.9f),
                    border = BorderStroke(1.dp, Color(0xFF2D323E))
                ) {
                    Column(
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(text = "DRIFT POINTS", fontSize = 10.sp, color = Color(0xFF9CA3AF))
                        Text(text = "$driftScore", fontSize = 18.sp, fontWeight = FontWeight.Black, color = Color(0xFFD4A24C))
                    }
                }

                IconButton(
                    onClick = onExit,
                    colors = IconButtonDefaults.iconButtonColors(containerColor = Color(0xFFC53030).copy(alpha = 0.8f))
                ) {
                    Icon(Icons.Default.Close, contentDescription = "Sair", tint = Color.White)
                }
            }

            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = Color(0xFF111318).copy(alpha = 0.85f),
                    border = BorderStroke(1.dp, Color(0xFFD4A24C).copy(alpha = 0.5f))
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 24.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.Star, contentDescription = null, tint = Color(0xFFD4A24C))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "${speed.toInt()}",
                            fontSize = 32.sp,
                            fontWeight = FontWeight.Black,
                            color = Color(0xFFEFEDE7)
                        )
                        Text(
                            text = " KM/H",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFFD4A24C)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Button(
                        onClick = { speed = maxOf(40f, speed - 20f) },
                        modifier = Modifier.size(90.dp, 60.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFC53030))
                    ) {
                        Text("FREIO", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }

                    Button(
                        onClick = { isNitroActive = !isNitroActive; speed = if (isNitroActive) 280f else 180f },
                        modifier = Modifier.size(90.dp, 60.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF3182CE))
                    ) {
                        Text("NITRO", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }

                    Button(
                        onClick = { speed = minOf(320f, speed + 30f) },
                        modifier = Modifier.size(110.dp, 60.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD4A24C), contentColor = Color(0xFF0B0C0F))
                    ) {
                        Text("ACELERAR", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                }
            }
        }
    }
}
