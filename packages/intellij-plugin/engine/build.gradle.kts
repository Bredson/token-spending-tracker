plugins {
    kotlin("jvm")
    kotlin("plugin.serialization")
}

kotlin {
    jvmToolchain(21)
}

dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.9.0")
    testImplementation(kotlin("test"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.13.4")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

// Te same fixture'y JSONL co silnik TypeScript — jedno źródło prawdy dla obu implementacji.
sourceSets.test {
    resources.srcDir("../../engine/test/fixtures")
}

tasks.test {
    useJUnitPlatform()
}
