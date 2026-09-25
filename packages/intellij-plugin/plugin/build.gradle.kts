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

// Lambda zbudowana tutaj łapie tylko `path` — odwołanie do właściwości skryptu wprost
// w lambdzie łapie cały obiekt skryptu, którego configuration cache nie umie zapisać.
fun openProjectArgs(path: Provider<String>) = CommandLineArgumentProvider { listOfNotNull(path.orNull) }

tasks.runIde {
    argumentProviders.add(openProjectArgs(openProjectPath))
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
    pluginVerification {
        ides {
            create(org.jetbrains.intellij.platform.gradle.IntelliJPlatformType.IntellijIdeaUltimate, "2025.3.6.1")
            create(org.jetbrains.intellij.platform.gradle.IntelliJPlatformType.IntellijIdeaUltimate, "2026.1.5")
            create(org.jetbrains.intellij.platform.gradle.IntelliJPlatformType.IntellijIdeaUltimate, "2026.2.3")
        }
    }
}

// `gradle :plugin:runIdeLatest` — ten sam plugin w najnowszym wydaniu IntelliJ IDEA.
intellijPlatformTesting {
    runIde {
        register("runIdeLatest") {
            type = org.jetbrains.intellij.platform.gradle.IntelliJPlatformType.IntellijIdeaUltimate
            version = "2026.2.3"
            task {
                argumentProviders.add(openProjectArgs(openProjectPath))
            }
        }
    }
}
