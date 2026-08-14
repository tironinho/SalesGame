/**
 * Descobre e executa todos os *.test.mjs sob src/ via node:test.
 * Windows-friendly (sem depender de glob do shell).
 */
import { spawnSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const srcRoot = join(__dirname, '..', 'src')

function walk(dir, out = []) {
  let entries = []
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries) {
    const p = join(dir, name)
    let st
    try {
      st = statSync(p)
    } catch {
      continue
    }
    if (st.isDirectory()) walk(p, out)
    else if (name.endsWith('.test.mjs')) out.push(p)
  }
  return out
}

const files = walk(srcRoot).sort()
if (!files.length) {
  console.error('Nenhum *.test.mjs encontrado em src/')
  process.exit(1)
}

console.log(`node --test (${files.length} arquivos)`)
const result = spawnSync(process.execPath, ['--test', ...files], {
  stdio: 'inherit',
  shell: false,
})
process.exit(result.status ?? 1)
