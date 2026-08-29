package com.novusactus.interveniens.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.outlined.EmojiEvents
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import com.novusactus.interveniens.ui.leaderboard.LeaderboardScreen
import com.novusactus.interveniens.ui.notifications.NotificationsScreen
import com.novusactus.interveniens.ui.profile.ProfileScreen

private enum class MainTab(
    val title: String,
    val outlined: ImageVector,
    val filled: ImageVector,
) {
    Profile("Profile", Icons.Outlined.Person, Icons.Filled.Person),
    Leaderboard("Leaderboard", Icons.Outlined.EmojiEvents, Icons.Filled.EmojiEvents),
    Notifications("Notifications", Icons.Outlined.Notifications, Icons.Filled.Notifications),
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScaffold() {
    var tab by rememberSaveable { mutableStateOf(MainTab.Profile) }
    val snackbarHostState = remember { SnackbarHostState() }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text(tab.title) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface,
                ),
            )
        },
        bottomBar = {
            NavigationBar {
                MainTab.entries.forEach { entry ->
                    val selected = tab == entry
                    NavigationBarItem(
                        selected = selected,
                        onClick = { tab = entry },
                        icon = {
                            Icon(
                                if (selected) entry.filled else entry.outlined,
                                contentDescription = entry.title,
                            )
                        },
                        label = { Text(entry.title) },
                    )
                }
            }
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
        ) {
            when (tab) {
                MainTab.Profile -> ProfileScreen(snackbarHostState = snackbarHostState)
                MainTab.Leaderboard -> LeaderboardScreen()
                MainTab.Notifications -> NotificationsScreen()
            }
        }
    }
}
