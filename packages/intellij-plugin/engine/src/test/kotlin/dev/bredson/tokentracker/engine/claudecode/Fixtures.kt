package dev.bredson.tokentracker.engine.claudecode

object Fixtures {
    val sampleSessionLines: List<String> by lazy {
        val text = checkNotNull(Fixtures::class.java.getResource("/sample-session.jsonl")) {
            "fixture sample-session.jsonl not on test classpath"
        }.readText()
        text.lines().filter { it.isNotBlank() }
    }

    val sampleSessionParsed: List<ParsedEntry> by lazy {
        sampleSessionLines.mapNotNull(::parseLine)
    }
}
