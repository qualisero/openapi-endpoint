#!/usr/bin/env node

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { spawn } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Execute the TypeScript CLI script
const scriptPath = join(__dirname, '..', 'dist', 'cli.js')

const child = spawn('node', [scriptPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: false,
})

child.on('exit', (code) => {
  process.exit(code || 0)
})

child.on('error', (error) => {
  console.error('Error executing CLI:', error)
  process.exit(1)
})
