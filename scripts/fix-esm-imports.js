#!/usr/bin/env node

/**
 * Post-build script to add .js extensions to relative ESM imports.
 *
 * This is needed because:
 * - The package uses "type": "module" in package.json
 * - TypeScript with moduleResolution: "bundler" doesn't emit .js extensions
 * - Node.js ESM requires .js extensions for relative imports
 * - Bundlephobia and other tools need to run the code directly in Node.js
 */

import * as fs from 'fs'
import * as path from 'path'

const distDir = path.join(process.cwd(), 'dist')

function fixImportsInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const fixedLines = lines.map((line) => {
    // Match: import/export ... from './something' or from './something/...'
    // Don't match: from 'package' or from 'package/sub'
    const importExportMatch = line.match(/^(import\s+.*?\s+from\s+|export\s+.*?\s+from\s+)(['"])(\.{1,2}\/[^'"]*?)\2/)

    if (importExportMatch) {
      const [, prefix, quote, importPath] = importExportMatch

      // Skip if it already has an extension
      if (importPath.endsWith('.js') || importPath.endsWith('.mjs') || importPath.endsWith('.cjs')) {
        return line
      }

      // Add .js extension for relative imports
      const fixedPath = importPath + '.js'
      return line.replace(importExportMatch[0], `${prefix}${quote}${fixedPath}${quote}`)
    }

    return line
  })

  const fixedContent = fixedLines.join('\n')

  // Only write if changed
  if (fixedContent !== content) {
    fs.writeFileSync(filePath, fixedContent, 'utf-8')
    console.log(`✅ Fixed: ${path.relative(process.cwd(), filePath)}`)
    return true
  }

  return false
}

function walkDir(dir, callback) {
  const files = fs.readdirSync(dir)

  for (const file of files) {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)

    if (stat.isDirectory()) {
      walkDir(filePath, callback)
    } else if (file.endsWith('.js') && !file.endsWith('.d.ts')) {
      callback(filePath)
    }
  }
}

// Fix all .js files in dist directory
console.log('🔧 Fixing ESM imports in dist directory...')
let fixedCount = 0

if (fs.existsSync(distDir)) {
  walkDir(distDir, (filePath) => {
    if (fixImportsInFile(filePath)) {
      fixedCount++
    }
  })
  console.log(`✨ Fixed ${fixedCount} file(s)`)
} else {
  console.log('⚠️  dist directory not found')
}
