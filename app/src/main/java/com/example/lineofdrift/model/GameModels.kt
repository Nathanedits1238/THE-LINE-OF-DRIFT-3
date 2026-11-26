package com.example.lineofdrift.model

import kotlinx.serialization.Serializable

@Serializable
data class PlayerProfile(
    val name: String = "Luca Silva",
    val nickname: String = "DriftKing",
    val cash: Int = 25000,
    val repLevel: Int = 3,
    val repPoints: Int = 1420,
    val selectedCarId: String = "jdm_s15",
    val selectedTrackId: String = "track_neon_city",
    val careerWins: Int = 12,
    val totalEscapes: Int = 8,
    val copsDestroyed: Int = 15,
    val storyChapter: Int = 1,
    val controlsMode: String = "touch",
    val soundVolume: Float = 0.8f,
    val musicVolume: Float = 0.6f,
    val gyroSensitivity: Float = 1.2f,
    val graphicsQuality: String = "high"
)

@Serializable
data class Vehicle(
    val id: String,
    val name: String,
    val category: String, // muscle, jdm, super, police
    val price: Int,
    val topSpeed: Int,
    val acceleration: Int,
    val handling: Int,
    val braking: Int,
    var unlocked: Boolean,
    var color: String,
    var neonColor: String,
    var neonEnabled: Boolean,
    var levelEngine: Int = 1,
    var levelHandling: Int = 1,
    var levelNitro: Int = 1,
    var levelArmor: Int = 1
)

@Serializable
data class StoryChapterModel(
    val id: Int,
    val title: String,
    val subtitle: String,
    val briefing: String,
    val objectiveText: String,
    val rewardCash: Int,
    val rewardRep: Int,
    var unlocked: Boolean,
    var completed: Boolean
)

@Serializable
data class ChallengeModel(
    val id: Int,
    val title: String,
    val description: String,
    val reward: Int,
    val targetType: String,
    val targetValue: Int,
    var completed: Boolean
)

@Serializable
data class MultiplayerRoomModel(
    val code: String,
    val trackId: String,
    val hostName: String,
    val playerCount: Int,
    val maxPlayers: Int,
    val status: String
)

@Serializable
data class AchievementModel(
    val id: String,
    val title: String,
    val description: String,
    val category: String,
    val rewardCash: Int,
    var unlocked: Boolean
)

@Serializable
data class LeaderboardEntry(
    val rank: Int,
    val pilotName: String,
    val car: String,
    val scoreOrTime: String,
    val track: String
)
