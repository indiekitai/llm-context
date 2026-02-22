#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import { scanPath, formatBytes, formatNumber } from './index.js';

const MODEL_CONTEXTS = {
  'claude-3.5-sonnet': 200_000,
  'claude-3-opus': 200_000,
  'claude-3-haiku': 200_000,
  'gpt-4-turbo': 128_000,
  'gpt-4': 8_192,
  'gpt-4o': 128_000,
  'gpt-3.5-turbo': 16_385,
};

program
  .name('llm-context')
  .description('Calculate token budget for LLM context windows')
  .version('0.1.0')
  .argument('[paths...]', 'Files or directories to scan', ['.'])
  .option('-m, --model <model>', 'Target model for context comparison', 'claude-3.5-sonnet')
  .option('-t, --top <n>', 'Show top N largest files', '10')
  .option('-e, --ext <extensions>', 'Filter by extensions (comma-separated)', '')
  .option('--no-gitignore', 'Ignore .gitignore rules')
  .option('--json', 'Output as JSON')
  .action(async (paths, options) => {
    try {
      const scanPaths = paths.length ? paths : ['.'];
      const extensions = options.ext ? options.ext.split(',').map(e => e.trim()) : [];
      
      const results = await scanPath(scanPaths, {
        useGitignore: options.gitignore,
        extensions,
      });

      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      const contextSize = MODEL_CONTEXTS[options.model] || MODEL_CONTEXTS['claude-3.5-sonnet'];
      const usagePercent = ((results.totalTokens / contextSize) * 100).toFixed(1);
      
      // Header
      console.log();
      console.log(chalk.bold('📊 LLM Context Analysis'));
      console.log(chalk.gray('─'.repeat(50)));
      
      // Summary
      console.log();
      console.log(chalk.bold('Summary:'));
      console.log(`  Files scanned:  ${chalk.cyan(formatNumber(results.fileCount))}`);
      console.log(`  Total size:     ${chalk.cyan(formatBytes(results.totalBytes))}`);
      console.log(`  Total tokens:   ${chalk.cyan(formatNumber(results.totalTokens))}`);
      console.log();
      
      // Context usage bar
      const model = options.model;
      const barWidth = 30;
      const filledBars = Math.min(Math.round((results.totalTokens / contextSize) * barWidth), barWidth);
      const emptyBars = barWidth - filledBars;
      
      let barColor = chalk.green;
      if (usagePercent > 80) barColor = chalk.red;
      else if (usagePercent > 50) barColor = chalk.yellow;
      
      const bar = barColor('█'.repeat(filledBars)) + chalk.gray('░'.repeat(emptyBars));
      
      console.log(chalk.bold(`Context usage (${model}):`));
      console.log(`  [${bar}] ${usagePercent}%`);
      console.log(`  ${chalk.cyan(formatNumber(results.totalTokens))} / ${formatNumber(contextSize)} tokens`);
      
      if (results.totalTokens > contextSize) {
        console.log(chalk.red(`  ⚠️  Exceeds context by ${formatNumber(results.totalTokens - contextSize)} tokens!`));
      } else {
        console.log(chalk.green(`  ✓ ${formatNumber(contextSize - results.totalTokens)} tokens remaining`));
      }
      
      // Top files
      const topN = parseInt(options.top) || 10;
      if (results.files.length > 0) {
        console.log();
        console.log(chalk.bold(`Top ${Math.min(topN, results.files.length)} largest files:`));
        
        const sorted = [...results.files].sort((a, b) => b.tokens - a.tokens);
        const top = sorted.slice(0, topN);
        
        const maxPathLen = Math.min(Math.max(...top.map(f => f.path.length)), 50);
        
        for (const file of top) {
          const path = file.path.length > 50 ? '...' + file.path.slice(-47) : file.path;
          const pct = ((file.tokens / results.totalTokens) * 100).toFixed(1);
          const tokens = formatNumber(file.tokens).padStart(10);
          console.log(`  ${chalk.gray(path.padEnd(maxPathLen + 3))} ${chalk.cyan(tokens)} tokens (${pct}%)`);
        }
      }
      
      // By extension
      if (Object.keys(results.byExtension).length > 1) {
        console.log();
        console.log(chalk.bold('By file type:'));
        
        const extSorted = Object.entries(results.byExtension)
          .sort((a, b) => b[1].tokens - a[1].tokens)
          .slice(0, 8);
        
        for (const [ext, data] of extSorted) {
          const pct = ((data.tokens / results.totalTokens) * 100).toFixed(1);
          const label = (ext || '(no ext)').padEnd(12);
          console.log(`  ${chalk.yellow(label)} ${formatNumber(data.tokens).padStart(10)} tokens (${data.count} files, ${pct}%)`);
        }
      }
      
      console.log();
      
    } catch (err) {
      console.error(chalk.red('Error:'), err.message);
      process.exit(1);
    }
  });

program.parse();
