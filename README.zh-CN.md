[English](README.md) | [中文](README.zh-CN.md)

# llm-context

📊 **计算 LLM 上下文窗口的 Token 预算** —— 在粘贴之前就知道能放多少内容。

[![MCP](https://img.shields.io/badge/MCP-enabled-blue)](./mcp_server.py)

想知道你的代码库能放进 Claude 的 200K 上下文窗口多少？或者那个巨大的日志文件会不会用光你的 GPT-4 预算？`llm-context` 立刻告诉你。

## 安装

```bash
npm install -g llm-context
```

## 使用

```bash
# 扫描当前目录
llm-context

# 扫描指定路径
llm-context src/ lib/ README.md

# 对比特定模型
llm-context --model gpt-4

# 显示最大的 20 个文件
llm-context --top 20

# 按扩展名过滤
llm-context --ext ts,js,json

# JSON 输出
llm-context --json
```

## 输出示例

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

## 支持的模型

| 模型 | 上下文窗口 |
|------|-----------|
| claude-3.5-sonnet | 200,000 |
| claude-3-opus | 200,000 |
| claude-3-haiku | 200,000 |
| gpt-4-turbo | 128,000 |
| gpt-4o | 128,000 |
| gpt-4 | 8,192 |
| gpt-3.5-turbo | 16,385 |

## 特性

- 🚀 **快速** - 数秒内扫描数千个文件
- 🎯 **准确** - 使用 GPT tokenizer（与 Claude 的 tokenization 类似）
- 📁 **智能** - 遵循 `.gitignore`，跳过二进制文件
- 📊 **有洞察** - 按文件类型分解，显示最大文件
- 🎨 **美观** - 彩色输出，带进度条

## 为什么需要这个？

使用 AI 编码助手时，上下文就是一切。但上下文窗口是有限的。这个工具帮你：

1. **粘贴前规划** —— 知道文件是否放得下
2. **优化上下文** —— 找到最大的 Token 消耗者
3. **合理预算** —— 跨模型追踪 Token 用量

## MCP Server（AI Agent 集成）

llm-context 内置 Python MCP Server，可与 Claude、Cursor 等 AI 工具集成。

### 配置

```bash
pip install fastmcp tiktoken
```

### 添加到 Claude Desktop

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

### 可用工具

| 工具 | 描述 |
|------|------|
| `llm_context_scan` | 扫描文件/目录，显示 Token 用量与模型上下文的对比 |
| `llm_context_check` | 检查文本是否能放入模型的上下文窗口 |
| `llm_context_estimate` | 简单的字符串 Token 计数 |
| `llm_context_models` | 列出可用模型及其上下文大小 |

## 许可证

MIT
