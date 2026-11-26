package com.example.lineofdrift

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.example.lineofdrift.ui.screens.*
import com.example.lineofdrift.ui.theme.TheLineOfDriftTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            TheLineOfDriftTheme {
                TheLineOfDriftApp()
            }
        }
    }
}

@Composable
fun TheLineOfDriftApp() {
    val navController = rememberNavController()

    NavHost(navController = navController, startDestination = "title") {
        composable("title") {
            TitleScreen(
                onNavigate = { route -> navController.navigate(route) }
            )
        }
        composable("story") {
            StoryScreen(
                onBack = { navController.popBackStack() },
                onStartChapter = { chapterId -> navController.navigate("gameplay") }
            )
        }
        composable("career") {
            CareerScreen(
                onBack = { navController.popBackStack() },
                onStartFreeRoam = { navController.navigate("gameplay") }
            )
        }
        composable("garage") {
            GarageScreen(
                onBack = { navController.popBackStack() }
            )
        }
        composable("multiplayer") {
            MultiplayerScreen(
                onBack = { navController.popBackStack() },
                onJoinRoom = { code -> navController.navigate("gameplay") }
            )
        }
        composable("challenges") {
            ChallengesScreen(
                onBack = { navController.popBackStack() }
            )
        }
        composable("achievements") {
            AchievementsScreen(
                onBack = { navController.popBackStack() }
            )
        }
        composable("leaderboard") {
            LeaderboardScreen(
                onBack = { navController.popBackStack() }
            )
        }
        composable("settings") {
            SettingsScreen(
                onBack = { navController.popBackStack() }
            )
        }
        composable("gameplay") {
            GamePlayScreen(
                onExit = { navController.popBackStack() }
            )
        }
    }
}
