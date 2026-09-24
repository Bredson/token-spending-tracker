plugins {
    kotlin("jvm") version "2.3.0" apply false
    kotlin("plugin.serialization") version "2.3.0" apply false
    id("org.jetbrains.intellij.platform") version "2.19.0" apply false
}

allprojects {
    group = "dev.bredson.tokentracker"
    version = "0.1.0"
    repositories {
        mavenCentral()
    }
}
