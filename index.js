import fs from 'fs/promises';
import path from 'path';
import ignore from 'ignore';
import { encode } from 'gpt-tokenizer';

// Binary file extensions to skip
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg', '.bmp', '.tiff',
  '.mp3', '.wav', '.ogg', '.mp4', '.avi', '.mov', '.mkv', '.webm',
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.dat',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.pyc', '.pyo', '.class', '.o', '.a',
  '.sqlite', '.db', '.lock',
]);

// Default ignore patterns
const DEFAULT_IGNORES = [
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  'dist',
  'build',
  '.next',
  '.nuxt',
  'coverage',
  '.nyc_output',
  'vendor',
  'venv',
  '.venv',
  'env',
  '.env',
];

/**
 * Count tokens in text using GPT tokenizer (similar to Claude's)
 */
export function countTokens(text) {
  try {
    return encode(text).length;
  } catch {
    // Fallback: rough estimate of 4 chars per token
    return Math.ceil(text.length / 4);
  }
}

/**
 * Scan files and calculate token counts
 */
export async function scanPath(paths, options = {}) {
  const { useGitignore = true, extensions = [] } = options;
  
  const ig = ignore().add(DEFAULT_IGNORES);
  
  const results = {
    files: [],
    totalTokens: 0,
    totalBytes: 0,
    fileCount: 0,
    byExtension: {},
  };

  async function loadGitignore(dir) {
    if (!useGitignore) return;
    try {
      const gitignorePath = path.join(dir, '.gitignore');
      const content = await fs.readFile(gitignorePath, 'utf-8');
      ig.add(content.split('\n').filter(line => line && !line.startsWith('#')));
    } catch {
      // No .gitignore
    }
  }

  async function processFile(filePath, relativePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    // Skip binary files
    if (BINARY_EXTENSIONS.has(ext)) return;
    
    // Filter by extension if specified
    if (extensions.length > 0) {
      const normalizedExt = ext.startsWith('.') ? ext.slice(1) : ext;
      if (!extensions.includes(normalizedExt) && !extensions.includes(ext)) {
        return;
      }
    }

    try {
      const stat = await fs.stat(filePath);
      
      // Skip large files (> 10MB)
      if (stat.size > 10 * 1024 * 1024) return;
      
      const content = await fs.readFile(filePath, 'utf-8');
      const tokens = countTokens(content);
      
      results.files.push({
        path: relativePath,
        tokens,
        bytes: stat.size,
      });
      
      results.totalTokens += tokens;
      results.totalBytes += stat.size;
      results.fileCount++;
      
      // Track by extension
      const extKey = ext || '(no ext)';
      if (!results.byExtension[extKey]) {
        results.byExtension[extKey] = { tokens: 0, bytes: 0, count: 0 };
      }
      results.byExtension[extKey].tokens += tokens;
      results.byExtension[extKey].bytes += stat.size;
      results.byExtension[extKey].count++;
      
    } catch (err) {
      // Skip files that can't be read as text
    }
  }

  async function scanDir(dir, baseDir) {
    await loadGitignore(dir);
    
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);
      
      // Check ignore rules
      if (ig.ignores(relativePath)) continue;
      
      if (entry.isDirectory()) {
        await scanDir(fullPath, baseDir);
      } else if (entry.isFile()) {
        await processFile(fullPath, relativePath);
      }
    }
  }

  for (const p of paths) {
    try {
      const stat = await fs.stat(p);
      
      if (stat.isDirectory()) {
        await scanDir(p, p);
      } else if (stat.isFile()) {
        await processFile(p, p);
      }
    } catch (err) {
      console.error(`Warning: Cannot access ${p}: ${err.message}`);
    }
  }

  return results;
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function formatNumber(n) {
  return n.toLocaleString('en-US');
}
