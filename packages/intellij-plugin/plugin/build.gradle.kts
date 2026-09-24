plugins {
    kotlin("jvm")
    id("org.jetbrains.intellij.platform")
}

kotlin {
    jvmToolchain(21)
}

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
    }
}

dependencies {
    implementation(project(":engine"))
    intellijPlatform {
        intellijIdeaCommunity("2025.2")
    }
}

// Współdzielony HTML dashboardu — ten sam plik, który renderuje webview VS Code.
sourceSets.main {
    resources.srcDir("../../dashboard-ui")
}

// `gradle :plugin:runIde -PopenProject=/sciezka` otwiera projekt od razu w sandboxie.
val openProjectPath = providers.gradleProperty("openProject")
tasks.runIde {
    argumentProviders.add(CommandLineArgumentProvider { listOfNotNull(openProjectPath.orNull) })
}

intellijPlatform {
    pluginConfiguration {
        id = "dev.bredson.tokentracker"
        name = "Token Tracker"
        version = project.version.toString()
        description = """
            Local, fully offline tracking of Claude Code token usage and cost per task, session and project.
            Reads the logs Claude Code already writes to ~/.claude/projects and never touches the network.
        """.trimIndent()
        vendor {
            name = "Bredson"
            url = "https://github.com/Bredson/token-spending-tracker"
        }
        ideaVersion {
            sinceBuild = "252"
        }
    }
}
