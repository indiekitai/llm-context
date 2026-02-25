#!/usr/bin/env python3
"""
llm-context MCP Server

Provides token counting tools for AI agents:
- llm_context_scan: Scan files/directories and count tokens
- llm_context_check: Check if content fits in a model's context window
- llm_context_estimate: Estimate tokens for a string
"""

import os
import json
import sys
from pathlib import Path
from typing import Optional

# Try tiktoken first (OpenAI's tokenizer, similar to Claude's)
try:
    import tiktoken
    _encoder = tiktoken.get_encoding("cl100k_base")
    def count_tokens(text: str) -> int:
        return len(_encoder.encode(text))
except ImportError:
    # Fallback: rough estimate
    def count_tokens(text: str) -> int:
        return len(text) // 4

# FastMCP is optional
try:
    from fastmcp import FastMCP
    mcp = FastMCP("llm-context")
    HAS_MCP = True
except ImportError:
    HAS_MCP = False
    class DummyMCP:
        def tool(self):
            def decorator(f):
                return f
            return decorator
    mcp = DummyMCP()

# Model context windows
MODELS = {
    "claude-3.5-sonnet": 200_000,
    "claude-3-opus": 200_000,
    "claude-3-sonnet": 200_000,
    "claude-3-haiku": 200_000,
    "gpt-4-turbo": 128_000,
    "gpt-4": 8_192,
    "gpt-4-32k": 32_768,
    "gpt-3.5-turbo": 16_385,
    "gemini-pro": 32_000,
    "gemini-1.5-pro": 1_000_000,
}

# Binary extensions to skip
BINARY_EXTS = {
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg', '.bmp',
    '.mp3', '.wav', '.mp4', '.avi', '.mov', '.mkv', '.webm',
    '.zip', '.tar', '.gz', '.7z', '.rar', '.pdf',
    '.exe', '.dll', '.so', '.dylib', '.bin',
    '.woff', '.woff2', '.ttf', '.otf',
    '.pyc', '.pyo', '.class', '.o',
    '.sqlite', '.db', '.lock',
}

# Default ignore patterns
IGNORE_DIRS = {
    'node_modules', '.git', '__pycache__', '.venv', 'venv',
    'dist', 'build', '.next', 'coverage', 'vendor', '.pytest_cache',
}


def format_bytes(size: int) -> str:
    """Format bytes to human readable."""
    if size < 1024:
        return f"{size} B"
    if size < 1024 * 1024:
        return f"{size / 1024:.1f} KB"
    if size < 1024 * 1024 * 1024:
        return f"{size / (1024 * 1024):.1f} MB"
    return f"{size / (1024 * 1024 * 1024):.1f} GB"


def scan_path(path: str, extensions: list[str] = None) -> dict:
    """Scan a path and count tokens."""
    results = {
        "files": [],
        "total_tokens": 0,
        "total_bytes": 0,
        "file_count": 0,
        "by_extension": {},
    }
    
    root = Path(path).resolve()
    
    if root.is_file():
        # Single file
        try:
            content = root.read_text(encoding='utf-8', errors='ignore')
            tokens = count_tokens(content)
            size = root.stat().st_size
            results["files"].append({
                "path": str(root),
                "tokens": tokens,
                "bytes": size,
            })
            results["total_tokens"] = tokens
            results["total_bytes"] = size
            results["file_count"] = 1
        except Exception:
            pass
        return results
    
    # Directory scan
    for dirpath, dirnames, filenames in os.walk(root):
        # Skip ignored directories
        dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS]
        
        for filename in filenames:
            filepath = Path(dirpath) / filename
            ext = filepath.suffix.lower()
            
            # Skip binary files
            if ext in BINARY_EXTS:
                continue
            
            # Filter by extension if specified
            if extensions:
                ext_no_dot = ext.lstrip('.')
                if ext_no_dot not in extensions and ext not in extensions:
                    continue
            
            try:
                stat = filepath.stat()
                # Skip large files (> 10MB)
                if stat.st_size > 10 * 1024 * 1024:
                    continue
                
                content = filepath.read_text(encoding='utf-8', errors='ignore')
                tokens = count_tokens(content)
                rel_path = str(filepath.relative_to(root))
                
                results["files"].append({
                    "path": rel_path,
                    "tokens": tokens,
                    "bytes": stat.st_size,
                })
                results["total_tokens"] += tokens
                results["total_bytes"] += stat.st_size
                results["file_count"] += 1
                
                # Track by extension
                ext_key = ext or "(no ext)"
                if ext_key not in results["by_extension"]:
                    results["by_extension"][ext_key] = {"tokens": 0, "bytes": 0, "count": 0}
                results["by_extension"][ext_key]["tokens"] += tokens
                results["by_extension"][ext_key]["bytes"] += stat.st_size
                results["by_extension"][ext_key]["count"] += 1
                
            except Exception:
                pass
    
    return results


@mcp.tool()
def llm_context_scan(
    path: str = ".",
    extensions: Optional[str] = None,
    model: str = "claude-3.5-sonnet",
    top: int = 10,
) -> str:
    """
    Scan files/directories and calculate token usage.
    
    Returns:
    - Total tokens and file count
    - Context window usage percentage for the specified model
    - Top N largest files by token count
    - Breakdown by file extension
    
    Args:
        path: File or directory to scan (default: current directory)
        extensions: Comma-separated list of extensions to include (e.g., "ts,js,py")
        model: LLM model to compare against (default: claude-3.5-sonnet)
        top: Number of largest files to show (default: 10)
    """
    try:
        ext_list = [e.strip().lstrip('.') for e in extensions.split(",")] if extensions else None
        results = scan_path(path, ext_list)
        
        # Get model context window
        context_window = MODELS.get(model, 200_000)
        usage_pct = (results["total_tokens"] / context_window) * 100
        remaining = context_window - results["total_tokens"]
        
        # Sort files by tokens
        sorted_files = sorted(results["files"], key=lambda x: x["tokens"], reverse=True)
        
        # Build response
        response = {
            "path": str(Path(path).resolve()),
            "summary": {
                "files_scanned": results["file_count"],
                "total_tokens": results["total_tokens"],
                "total_size": format_bytes(results["total_bytes"]),
            },
            "context_usage": {
                "model": model,
                "context_window": context_window,
                "used_tokens": results["total_tokens"],
                "remaining_tokens": max(0, remaining),
                "usage_percent": round(usage_pct, 1),
                "fits": remaining >= 0,
            },
            "top_files": [
                {"path": f["path"], "tokens": f["tokens"], "size": format_bytes(f["bytes"])}
                for f in sorted_files[:top]
            ],
            "by_extension": {
                ext: {
                    "tokens": data["tokens"],
                    "files": data["count"],
                    "size": format_bytes(data["bytes"]),
                }
                for ext, data in sorted(
                    results["by_extension"].items(),
                    key=lambda x: x[1]["tokens"],
                    reverse=True
                )
            },
        }
        
        return json.dumps(response, indent=2)
        
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def llm_context_check(
    text: str,
    model: str = "claude-3.5-sonnet",
) -> str:
    """
    Check if text fits in a model's context window.
    
    Quick way to verify if content will fit before pasting into an LLM.
    
    Args:
        text: The text to check
        model: LLM model to check against (default: claude-3.5-sonnet)
    """
    try:
        tokens = count_tokens(text)
        context_window = MODELS.get(model, 200_000)
        usage_pct = (tokens / context_window) * 100
        remaining = context_window - tokens
        
        return json.dumps({
            "tokens": tokens,
            "characters": len(text),
            "model": model,
            "context_window": context_window,
            "usage_percent": round(usage_pct, 1),
            "remaining_tokens": max(0, remaining),
            "fits": remaining >= 0,
            "verdict": "✅ Fits" if remaining >= 0 else f"❌ Exceeds by {abs(remaining):,} tokens",
        }, indent=2)
        
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def llm_context_estimate(
    text: str,
) -> str:
    """
    Estimate token count for a string.
    
    Simple token counting without model comparison.
    
    Args:
        text: The text to count tokens for
    """
    try:
        tokens = count_tokens(text)
        return json.dumps({
            "tokens": tokens,
            "characters": len(text),
            "ratio": round(len(text) / tokens, 2) if tokens > 0 else 0,
        })
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def llm_context_models() -> str:
    """
    List available models and their context window sizes.
    
    Returns all supported models with their token limits.
    """
    return json.dumps({
        "models": [
            {"name": name, "context_window": size}
            for name, size in sorted(MODELS.items(), key=lambda x: -x[1])
        ]
    }, indent=2)


def main():
    """Run the MCP server."""
    if not HAS_MCP:
        print("Error: fastmcp not installed.", file=sys.stderr)
        print("Install with: pip install fastmcp", file=sys.stderr)
        sys.exit(1)
    mcp.run()


if __name__ == "__main__":
    main()
