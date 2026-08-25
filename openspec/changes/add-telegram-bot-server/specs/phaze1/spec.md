## ADDED Requirements

### Requirement: Telegram Bot Connection

The service SHALL be implemented as a scoped Effect service (`Effect.Service`) that connects to the Telegram Bot API using Telegraf and begins long-polling for updates when the service is built. The service SHALL register a scope finalizer that stops the bot when the scope closes, rather than using an acquire/release pair (the bot runs continuously until shutdown).

#### Scenario: Bot starts with valid token

- **WHEN** the service starts and a valid `TELEGRAM_BOT_TOKEN` is provided
- **THEN** the bot connects to Telegram and begins long-polling for incoming updates

#### Scenario: Bot shuts down gracefully

- **WHEN** the process receives a termination signal (SIGINT/SIGTERM)
- **THEN** the service scope closes, its finalizer stops the bot, and the process exits

### Requirement: Bot Token Configuration

The service SHALL read the Telegram bot token from configuration via Effect's Config, and MUST fail to start with a clear error when the token is missing.

#### Scenario: Token provided

- **WHEN** the `TELEGRAM_BOT_TOKEN` environment variable is set
- **THEN** the service uses it to authenticate the Telegraf client

#### Scenario: Token missing

- **WHEN** the `TELEGRAM_BOT_TOKEN` environment variable is not set
- **THEN** the service fails to start and reports a clear configuration error indicating the missing token

### Requirement: Static Text Reply

The service SHALL reply to any incoming text message with the static text `hello`. The message handler SHALL be modelled as an Effect and executed on the service's Effect runtime.

#### Scenario: User sends a text message

- **WHEN** a user sends any text message to the bot
- **THEN** the bot replies in the same chat with the text `hello`

#### Scenario: Reply targets the originating chat

- **WHEN** the bot replies to an incoming message
- **THEN** the reply is delivered to the chat from which the message originated

### Requirement: Effect-Idiomatic Observability

The service SHALL perform all logging and error reporting through Effect's logging (e.g. `Effect.log` / `Effect.logError`) and MUST NOT use `console` directly.

#### Scenario: Startup and reply logging

- **WHEN** the bot starts polling or replies to a message
- **THEN** the corresponding log lines are emitted via Effect's logger

#### Scenario: Failure reporting

- **WHEN** the program fails for a non-interruption reason
- **THEN** the failure cause is reported via `Effect.logError` and the process exits with a non-zero code
