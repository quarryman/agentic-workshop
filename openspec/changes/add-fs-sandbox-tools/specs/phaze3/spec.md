## ADDED Requirements

### Requirement: Sandbox Root Configuration

The system SHALL read a single sandbox root directory from configuration via Effect's `Config` (`SANDBOX_ROOT`), defaulting to the current working directory, and SHALL resolve it to an absolute path once when the tools are constructed. All filesystem tools SHALL operate relative to this root.

#### Scenario: Root provided

- **WHEN** `SANDBOX_ROOT` is set to a directory
- **THEN** all tools resolve their path arguments relative to that directory

#### Scenario: Root defaulted

- **WHEN** `SANDBOX_ROOT` is not set
- **THEN** the sandbox root defaults to the current working directory

### Requirement: Read-Only Filesystem Tools

The system SHALL expose the following read-only tools to the agent: `ls`, `cat`, `grep`, `find`, `head`, `tail`, and `tree`. These tools SHALL only read filesystem contents and metadata and MUST NOT create, modify, move, delete files, or execute arbitrary commands. Each tool SHALL be defined with a typed argument schema and SHALL return its result as text.

#### Scenario: Listing a directory

- **WHEN** the agent calls `ls` for a directory inside the sandbox
- **THEN** the tool returns the directory's entries with their type and size

#### Scenario: Reading a file

- **WHEN** the agent calls `cat`, `head`, or `tail` for a file inside the sandbox
- **THEN** the tool returns the requested (bounded) text content of that file

#### Scenario: Searching content and files

- **WHEN** the agent calls `grep` with a pattern or `find` with a glob under a sandbox path
- **THEN** the tool returns the matching lines (`file:line: match`) or matching file paths respectively

#### Scenario: Viewing structure

- **WHEN** the agent calls `tree` for a directory inside the sandbox
- **THEN** the tool returns a depth-limited textual tree of that directory

#### Scenario: No mutation is possible

- **WHEN** any tool is invoked
- **THEN** no filesystem entry is created, modified, or removed, and no arbitrary shell command is executed

### Requirement: Path Confinement

Every tool SHALL resolve path arguments against the sandbox root and SHALL reject any path that escapes the root — including `..` traversal, absolute paths outside the root, and symlinks whose real target lies outside the root. A rejected path SHALL return a clear error message rather than accessing the target.

#### Scenario: Path escapes via traversal

- **WHEN** a tool is called with a path that resolves outside the sandbox root (e.g. `../../etc/passwd`)
- **THEN** the tool returns an error indicating the path is outside the sandbox and reads nothing

#### Scenario: Symlink escape

- **WHEN** a tool is called with a path that is a symlink whose real target is outside the sandbox root
- **THEN** the tool returns an error and does not read the target

#### Scenario: Valid in-sandbox path

- **WHEN** a tool is called with a path that resolves to the root or a location beneath it
- **THEN** the tool proceeds with the read operation

### Requirement: Bounded Tool Output

Tool results SHALL be bounded by configured limits on bytes, lines, and entries, and SHALL indicate when output was truncated so the agent knows the result is incomplete.

#### Scenario: Output exceeds limit

- **WHEN** a tool's result would exceed the configured byte/line/entry limit
- **THEN** the tool returns the truncated result together with an explicit truncation notice
