package dev.bredson.tokentracker.engine

fun record(
    id: String = "rec",
    source: String = "claude-code",
    sessionId: String = "session-1",
    taskId: String = "task-1",
    timestamp: String = "2026-03-10T12:00:00.000Z",
    model: String = "claude-sonnet-5",
    tokensInput: Long = 100,
    tokensOutput: Long = 50,
    tokensCacheRead: Long = 0,
    tokensCacheWrite: Long = 0,
    costUsd: Double = 1.0,
    projectPath: String = "/tmp/project-a",
) = UsageRecord(
    id, source, sessionId, taskId, timestamp, model,
    tokensInput, tokensOutput, tokensCacheRead, tokensCacheWrite, costUsd, projectPath,
)
