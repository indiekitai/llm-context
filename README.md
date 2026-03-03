[English](README.md) | [中文](README.zh-CN.md)

# llm-context

📊 **Calculate token budget for LLM context windows** - know what fits before you paste.

[![MCP](https://img.shields.io/badge/MCP-enabled-blue)](./mcp_server.py)

Ever wondered how much of your codebase will fit in Claude's 200K context window? Or whether that massive log file will blow your GPT-4 budget? `llm-context` tells you instantly.

## Install

```bash
npm install -g llm-context
```

## Usage

```bash
# Scan current directory
llm-context

# Scan specific paths
llm-context src/ lib/ README.md

# Compare against a specific model
llm-context --model gpt-4

# Show top 20 largest files
llm-context --top 20

# Filter by extensions
llm-context --ext ts,js,json

# Output as JSON
llm-context --json
```

## Example Output

```
📊 LLM Context Analysis
──────────────────────────────────────────────────

Summary:
  Files scanned:  142
  Total size:     847.3 KB
  Total tokens:   198,432

Context usage (claude-3.5-sonnet):
  [████████████████████████░░░░░░] 79.4%
  198,432 / 200,000 tokens
  ✓ 1,568 tokens remaining

Top 10 largest files:
  src/parser.ts                    42,156 tokens (21.2%)
  src/analyzer.ts                  28,934 tokens (14.6%)
  tests/fixtures/large.json        15,221 tokens (7.7%)
  ...

By file type:
  .ts           142,156 tokens (89 files, 71.6%)
  .json          32,144 tokens (23 files, 16.2%)
  .md            24,132 tokens (30 files, 12.2%)
```

## Supported Models

| Model | Context Window |
|-------|----------------|
| claude-3.5-sonnet | 200,000 |
| claude-3-opus | 200,000 |
| claude-3-haiku | 200,000 |
| gpt-4-turbo | 128,000 |
| gpt-4o | 128,000 |
| gpt-4 | 8,192 |
| gpt-3.5-turbo | 16,385 |

## Features

- 🚀 **Fast** - Scans thousands of files in seconds
- 🎯 **Accurate** - Uses GPT tokenizer (similar to Claude's tokenization)
- 📁 **Smart** - Respects `.gitignore`, skips binary files
- 📊 **Insightful** - Shows breakdown by file type, largest files
- 🎨 **Pretty** - Color-coded output with progress bars

## Why?

When working with AI coding assistants, context is everything. But context windows are limited. This tool helps you:

1. **Plan before pasting** - Know if your files will fit
2. **Optimize context** - Find the biggest token hogs
3. **Budget wisely** - Track token usage across models

## MCP Server (for AI Agents)

llm-context includes a Python MCP server for integration with Claude, Cursor, and other AI tools.

### Setup

```bash
pip install fastmcp tiktoken
```

### Add to Claude Desktop

```json
{
  "mcpServers": {
    "llm-context": {
      "command": "python",
      "args": ["/path/to/llm-context/mcp_server.py"]
    }
  }
}
```

### Available Tools

| Tool | Description |
|------|-------------|
| `llm_context_scan` | Scan files/dirs and show token usage vs model context |
| `llm_context_check` | Check if text fits in a model's context window |
| `llm_context_estimate` | Simple token count for a string |
| `llm_context_models` | List available models and their context sizes |

### Example Usage

```
> How many tokens is my src/ folder?
[uses llm_context_scan]

> Will this log file fit in GPT-4's context?
[uses llm_context_check with model="gpt-4"]

> List supported models
[uses llm_context_models]
```

## License

MIT
