/**
 * Script para iniciar servidor de desenvolvimento e executar testes
 * 
 * Este script inicia o servidor Vite e fornece instruções para executar os testes.
 */

import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

console.log('🚀 Iniciando servidor de desenvolvimento...\n')

// Verificar se já está rodando
const checkPort = async (port) => {
  try {
    const response = await fetch(`http://localhost:${port}`)
    return true
  } catch {
    return false
  }
}

// Iniciar servidor
const viteProcess = spawn('npm', ['run', 'dev'], {
  cwd: projectRoot,
  shell: true,
  stdio: 'inherit'
})

console.log('\n✅ Servidor iniciado!')
console.log('\n📋 Próximos passos:')
console.log('   1. Aguarde o servidor iniciar completamente')
console.log('   2. Abra o navegador em: http://localhost:5173')
console.log('   3. Abra o Console do Navegador (F12)')
console.log('   4. Execute um dos comandos abaixo:\n')
console.log('   🔹 runAllTests()              - Executa todos os testes')
console.log('   🔹 testTurnAlternation()      - Apenas testes de turnos')
console.log('   🔹 const t = new TurnAlternationTester(); t.runAllTests()\n')
console.log('💡 Dica: Use test-runner.html para uma interface visual!\n')
console.log('⚠️  Pressione Ctrl+C para parar o servidor\n')

// Aguardar sinal de parada
process.on('SIGINT', () => {
  console.log('\n\n🛑 Parando servidor...')
  viteProcess.kill()
  process.exit(0)
})

viteProcess.on('exit', (code) => {
  console.log(`\n✅ Servidor parado (código: ${code})`)
  process.exit(code)
})


