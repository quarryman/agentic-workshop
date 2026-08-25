## ADDED Requirements

### Requirement: Tool Invocation Logging

The system SHALL emit an Effect log line when a filesystem tool is invoked and when it completes. Logging SHALL use Effect's logger (no `console`) and SHALL NOT alter the tool's arguments or result.

#### Scenario: Successful invocation is logged

- **WHEN** the agent calls a filesystem tool that completes successfully
- **THEN** a start log line and a completion log line are emitted via Effect's logger, and the tool's returned text is unchanged

#### Scenario: Failed or rejected invocation is logged

- **WHEN** a tool invocation fails (I/O error) or is rejected (path outside the sandbox / invalid input)
- **THEN** a completion log line is emitted at a higher level including the failure reason, and the tool still returns its failure text to the agent

### Requirement: Structured Log Annotations

Tool invocation logs SHALL carry structured context attached via Effect log annotations (`Effect.annotateLogs`), including at least the tool name, the invocation arguments, the outcome, the duration in milliseconds, and the result size. Annotations SHALL be scoped to a single invocation so concurrent tool calls do not share context, and MUST NOT contain secrets.

#### Scenario: Annotations present on tool logs

- **WHEN** a tool invocation is logged
- **THEN** the log line includes annotations for the tool name, arguments, outcome, duration, and result size

#### Scenario: Outcome is classified

- **WHEN** an invocation completes
- **THEN** its logged outcome annotation is one of `success`, `rejected`, or `error`

#### Scenario: Concurrent invocations keep separate context

- **WHEN** multiple tool invocations run concurrently
- **THEN** each invocation's log annotations reflect only its own tool name and arguments

#### Scenario: No secrets in annotations

- **WHEN** arguments are annotated onto a log line
- **THEN** only filesystem paths/patterns are included and no API keys or tokens are logged
