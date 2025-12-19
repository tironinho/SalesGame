/**
 * Script para executar testes de alternância de turnos
 * 
 * Este script verifica se o ambiente está configurado corretamente
 * e fornece instruções para executar os testes no navegador.
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

console.log('🧪 Verificando ambiente para testes de alternância de turnos...\n')

// Verificar se os arquivos de teste existem
const testFiles = [
  'src/game/__tests__/turnAlternationTest.js',
  'src/game/__tests__/testControlPanel.js',
  'src/game/__tests__/index.js'
]

console.log('📁 Verificando arquivos de teste:')
let allFilesExist = true
testFiles.forEach(file => {
  try {
    const filePath = join(projectRoot, file)
    readFileSync(filePath, 'utf-8')
    console.log(`  ✅ ${file}`)
  } catch (error) {
    console.log(`  ❌ ${file} - NÃO ENCONTRADO`)
    allFilesExist = false
  }
})

if (!allFilesExist) {
  console.log('\n❌ Alguns arquivos de teste não foram encontrados!')
  process.exit(1)
}

console.log('\n✅ Todos os arquivos de teste estão presentes!')
console.log('\n📋 Próximos passos:')
console.log('   1. Execute: npm run dev')
console.log('   2. Abra o navegador em http://localhost:5173')
console.log('   3. Abra o Console (F12)')
console.log('   4. Execute: runAllTests()')
console.log('   5. Ou execute: testTurnAlternation()')
console.log('\n💡 Dica: Use test-runner.html para uma interface visual!')


