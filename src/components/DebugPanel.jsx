// src/components/DebugPanel.jsx
import React, { useState, useEffect, useRef } from 'react'
import { 
  debugMode, 
  getDebugStats, 
  exportDebugReport,
  exportFullDebugReport,
  getLogStats,
  clearLogs as clearLogCapture,
  logCapture
} from '../game/debugMode.js'
import { exportCashAudit, clearCashAudit, initCashAudit } from '../debug/cashAudit.js'

export default function DebugPanel({ players, turnIdx, round, gameOver, winner }) {
  const [isVisible, setIsVisible] = useState(false)
  const [stats, setStats] = useState({ total: 0, errors: 0, warnings: 0, errorRate: 0, warningRate: 0 })
  const [logStats, setLogStats] = useState({ total: 0, byLevel: {}, enabled: false })
  const [isDragging, setIsDragging] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const panelRef = useRef(null)

  useEffect(() => {
    const updateStats = () => {
      setStats(getDebugStats())
      setLogStats(getLogStats())
    }

    updateStats()
    const interval = setInterval(updateStats, 1000)
    return () => clearInterval(interval)
  }, [])

  const toggleDebugMode = () => {
    const enabled = debugMode.toggle()
    setIsVisible(enabled)
  }

  const handleExportReport = () => {
    const report = exportDebugReport()
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `debug-report-${new Date().toISOString().slice(0, 19)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportFullReport = () => {
    const fullReport = exportFullDebugReport()
    
    // Exporta como arquivo de texto (mais fácil de compartilhar)
    const textBlob = new Blob([fullReport.text], { type: 'text/plain;charset=utf-8' })
    const textUrl = URL.createObjectURL(textBlob)
    const textA = document.createElement('a')
    textA.href = textUrl
    textA.download = `debug-logs-completo-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`
    textA.click()
    URL.revokeObjectURL(textUrl)
    
    // Também exporta como JSON (para análise programática)
    const jsonBlob = new Blob([JSON.stringify(fullReport, null, 2)], { type: 'application/json' })
    const jsonUrl = URL.createObjectURL(jsonBlob)
    const jsonA = document.createElement('a')
    jsonA.href = jsonUrl
    jsonA.download = `debug-logs-completo-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`
    jsonA.click()
    URL.revokeObjectURL(jsonUrl)
    
    console.log('[DebugPanel] ✅ Relatório completo exportado (texto + JSON)')
  }

  const handleClearAll = () => {
    debugMode.clearHistory()
    clearLogCapture()
    clearCashAudit()
    setStats(getDebugStats())
    setLogStats(getLogStats())
    console.log('[DebugPanel] 🗑️ Todos os logs foram limpos')
  }

  const handleExportCashAudit = () => {
    const json = exportCashAudit({ download: true })
    console.log('[CashAudit] export json:', json)
  }

  const handleToggleCashAudit = () => {
    const enabled = !!window.__CASH_AUDIT__?.enabled
    initCashAudit({ enabled: !enabled })
    console.log('[CashAudit] enabled =', !enabled)
  }

  const handleMouseDown = (e) => {
    if (e.target.closest('button')) return // Não arrastar se clicar em botão
    
    setIsDragging(true)
    const rect = panelRef.current.getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
  }

  const handleMouseMove = (e) => {
    if (!isDragging) return
    
    setPosition({
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, dragOffset])

  if (!isVisible) {
    return (
      <div style={{
        background: '#1a1a1a',
        color: '#fff',
        padding: '6px 10px',
        borderRadius: '4px',
        border: '1px solid #333',
        cursor: 'pointer',
        fontSize: '11px',
        fontFamily: 'monospace',
        display: 'inline-block',
        userSelect: 'none'
      }} onClick={toggleDebugMode}>
        🐛 Debug
      </div>
    )
  }

  return (
    <div 
      ref={panelRef}
      style={{
        position: 'fixed',
        top: position.y || 10,
        left: position.x || 10,
        zIndex: 9999,
        background: '#1a1a1a',
        color: '#fff',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid #333',
        minWidth: '300px',
        maxHeight: '80vh',
        overflow: 'auto',
        fontSize: '12px',
        fontFamily: 'monospace',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
      }}
      onMouseDown={handleMouseDown}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, color: '#4CAF50' }}>🐛 Debug Panel</h3>
        <button
          onClick={toggleDebugMode}
          style={{
            background: '#ff4444',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '4px 8px',
            cursor: 'pointer',
            fontSize: '10px'
          }}
        >
          ✕
        </button>
      </div>

      {/* Estatísticas */}
      <div style={{ marginBottom: '12px' }}>
        <h4 style={{ margin: '0 0 8px 0', color: '#FFC107' }}>📊 Estatísticas de Validação</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
          <div>Total: {stats.total}</div>
          <div style={{ color: stats.errors > 0 ? '#ff4444' : '#4CAF50' }}>
            Erros: {stats.errors}
          </div>
          <div style={{ color: stats.warnings > 0 ? '#FFC107' : '#4CAF50' }}>
            Avisos: {stats.warnings}
          </div>
          <div>Taxa Erro: {stats.errorRate.toFixed(1)}%</div>
        </div>
      </div>

      {/* Estatísticas de Logs */}
      <div style={{ marginBottom: '12px' }}>
        <h4 style={{ margin: '0 0 8px 0', color: '#FFC107' }}>📝 Estatísticas de Logs</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
          <div>Total: {logStats.total}</div>
          <div style={{ color: logStats.enabled ? '#4CAF50' : '#ff4444' }}>
            Status: {logStats.enabled ? '✅ Ativo' : '❌ Inativo'}
          </div>
          {logStats.byLevel && (
            <>
              <div>Logs: {logStats.byLevel.log || 0}</div>
              <div style={{ color: '#FFC107' }}>Warns: {logStats.byLevel.warn || 0}</div>
              <div style={{ color: '#ff4444' }}>Errors: {logStats.byLevel.error || 0}</div>
              <div>Debug: {logStats.byLevel.debug || 0}</div>
            </>
          )}
        </div>
      </div>

      {/* Estado do Jogo */}
      <div style={{ marginBottom: '12px' }}>
        <h4 style={{ margin: '0 0 8px 0', color: '#FFC107' }}>🎮 Estado do Jogo</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
          <div>Jogadores: {players.length}</div>
          <div>Turno: {turnIdx + 1}</div>
          <div>Rodada: {round}</div>
          <div style={{ color: gameOver ? '#ff4444' : '#4CAF50' }}>
            Status: {gameOver ? 'Fim' : 'Ativo'}
          </div>
          {winner && <div>Vencedor: {winner.name}</div>}
        </div>
      </div>

      {/* Jogadores */}
      <div style={{ marginBottom: '12px' }}>
        <h4 style={{ margin: '0 0 8px 0', color: '#FFC107' }}>👥 Jogadores</h4>
        {players.map((player, index) => (
          <div key={player.id} style={{
            background: index === turnIdx ? '#333' : 'transparent',
            padding: '4px',
            borderRadius: '4px',
            marginBottom: '2px',
            border: player.bankrupt ? '1px solid #ff4444' : '1px solid transparent'
          }}>
            <div style={{ fontWeight: 'bold' }}>
              {player.name} {player.bankrupt ? '💀' : ''} {index === turnIdx ? '👑' : ''}
            </div>
            <div style={{ fontSize: '10px', opacity: 0.8 }}>
              Cash: ${player.cash?.toLocaleString() || 0} | 
              Clientes: {player.clients || 0} | 
              Vendedores: {player.vendedoresComuns || 0}
            </div>
          </div>
        ))}
      </div>

      {/* Ações */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={handleExportFullReport}
          style={{
            background: '#2196F3',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: '10px',
            fontWeight: 'bold'
          }}
          title="Exporta relatório completo com todos os logs (texto + JSON)"
        >
          📥 Exportar Logs Completos
        </button>
        <button
          onClick={handleExportReport}
          style={{
            background: '#4CAF50',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: '10px'
          }}
          title="Exporta apenas relatório de validação (JSON)"
        >
          📊 Exportar Validação
        </button>
        <button
          onClick={handleClearAll}
          style={{
            background: '#FF9800',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: '10px'
          }}
          title="Limpa todos os logs e histórico de validação"
        >
          🗑️ Limpar Tudo
        </button>

        <button
          onClick={handleExportCashAudit}
          style={{
            background: '#8e44ad',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: '10px'
          }}
          title="Exporta o audit log de saldo (JSON)"
        >
          💰 Exportar Cash Audit
        </button>

        <button
          onClick={handleToggleCashAudit}
          style={{
            background: window.__CASH_AUDIT__?.enabled ? '#2ecc71' : '#7f8c8d',
            color: '#111',
            border: 'none',
            borderRadius: '4px',
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: '10px',
            fontWeight: 800
          }}
          title="Ativa/desativa auditoria de saldo (runtime)"
        >
          {window.__CASH_AUDIT__?.enabled ? '✅ Cash Audit ON' : '❌ Cash Audit OFF'}
        </button>
      </div>

      {/* Instruções */}
      <div style={{ marginTop: '12px', padding: '8px', background: '#333', borderRadius: '4px', fontSize: '10px' }}>
        <div style={{ color: '#FFC107', marginBottom: '4px' }}>💡 Instruções:</div>
        <div>• Clique em "🐛 Debug" para ativar/desativar</div>
        <div>• Logs são capturados automaticamente quando debug está ativo</div>
        <div>• "📥 Exportar Logs Completos" gera arquivo .txt e .json</div>
        <div>• Compartilhe o arquivo .txt para análise de problemas</div>
        <div>• Todos os console.log com prefixos [DEBUG], [NET], [App], etc. são capturados</div>
      </div>
    </div>
  )
}
