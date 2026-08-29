import java.util.Properties

plugins {
    // AGP 9 provides built-in Kotlin support, so only the Compose compiler plugin is
    // applied on top of the Android application plugin (no separate kotlin-android).
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
}

// ---------------------------------------------------------------------------
// Database configuration is read from local.properties (never committed) or from
// environment variables, and injected into BuildConfig. See local.properties.example.
// ---------------------------------------------------------------------------
val localProps = Properties().apply {
    val f = rootProject.file("local.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}

fun dbConfig(key: String, default: String): String =
    localProps.getProperty(key) ?: System.getenv(key) ?: default

fun quote(value: String): String =
    "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""

android {
    namespace = "com.novusactus.interveniens"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.novusactus.interveniens"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // ---- External Postgres connection (edit local.properties to override) ----
        // 10.0.2.2 is the Android emulator's alias for the host machine's localhost.
        buildConfigField("String", "DB_HOST", quote(dbConfig("DB_HOST", "10.0.2.2")))
        buildConfigField("String", "DB_PORT", quote(dbConfig("DB_PORT", "5432")))
        buildConfigField("String", "DB_NAME", quote(dbConfig("DB_NAME", "novus_actus")))
        buildConfigField("String", "DB_USER", quote(dbConfig("DB_USER", "postgres")))
        buildConfigField("String", "DB_PASSWORD", quote(dbConfig("DB_PASSWORD", "postgres")))
        // sslmode: "disable" for local Postgres, "require" for most cloud providers
        // (Supabase / Neon / Railway / RDS).
        buildConfigField("String", "DB_SSLMODE", quote(dbConfig("DB_SSLMODE", "disable")))
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
        }
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    packaging {
        resources {
            excludes += setOf(
                "/META-INF/{AL2.0,LGPL2.1}",
                "META-INF/DEPENDENCIES",
                "META-INF/INDEX.LIST",
                "META-INF/LICENSE",
                "META-INF/LICENSE.txt",
                "META-INF/LICENSE.md",
                "META-INF/NOTICE",
                "META-INF/NOTICE.txt",
                "META-INF/NOTICE.md",
                "META-INF/*.kotlin_module",
                "META-INF/versions/9/module-info.class",
                "module-info.class"
            )
        }
    }
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.androidx.work.runtime.ktx)

    // External Postgres access straight from the app (hackathon happy-path only).
    implementation(libs.postgresql)

    testImplementation(libs.junit)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.junit)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
    debugImplementation(libs.androidx.compose.ui.tooling)
}
