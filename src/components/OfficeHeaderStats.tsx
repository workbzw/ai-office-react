import { useEffect, useState } from 'react'
import { AGENT_COUNT } from '@/scene/layout/officeLayout'
import { useOfficeStore } from '@/store/officeStore'

function useSystemMetrics() {
  const [metrics, setMetrics] = useState({ cpu: 32, memory: 68, network: 18.4 })

  useEffect(() => {
    const id = window.setInterval(() => {
      setMetrics({
        cpu: 28 + Math.floor(Math.random() * 12),
        memory: 62 + Math.floor(Math.random() * 14),
        network: Math.round((14 + Math.random() * 10) * 10) / 10,
      })
    }, 4000)
    return () => window.clearInterval(id)
  }, [])

  return metrics
}

export function OfficeHeaderStats() {
  const agents = useOfficeStore((s) => s.agents)
  const metrics = useSystemMetrics()

  const onlineCount = agents.filter(
    (a) => a.state !== 'idle' || a.currentTask,
  ).length

  return (
    <header className="office-header-stats">
      <div className="stat-card-lg">
        <span className="stat-card-label">今日任务</span>
        <span className="stat-card-value">6</span>
        <span className="stat-card-hint">进行中</span>
      </div>

      <div className="stat-card-lg">
        <span className="stat-card-label">已完成</span>
        <span className="stat-card-value">13</span>
        <span className="stat-card-hint">今日完成</span>
      </div>

      <div className="stat-card-lg">
        <span className="stat-card-label">待处理</span>
        <span className="stat-card-value">2</span>
        <span className="stat-card-hint">等待处理</span>
      </div>

      <div className="stat-card-lg">
        <span className="stat-card-label">AI 员工</span>
        <span className="stat-card-value">
          {onlineCount}/{AGENT_COUNT}
        </span>
        <span className="stat-card-hint online-hint">
          <span className="status-dot online" aria-hidden />
          全部在线
        </span>
      </div>

      <div className="stat-card-lg stat-card-resources">
        <span className="stat-card-label">系统资源</span>
        <div className="resource-rows">
          <div className="resource-row">
            <span>CPU</span>
            <div className="resource-bar">
              <div
                className="resource-fill cpu"
                style={{ width: `${metrics.cpu}%` }}
              />
            </div>
            <span className="resource-pct">{metrics.cpu}%</span>
          </div>
          <div className="resource-row">
            <span>内存</span>
            <div className="resource-bar">
              <div
                className="resource-fill memory"
                style={{ width: `${metrics.memory}%` }}
              />
            </div>
            <span className="resource-pct">{metrics.memory}%</span>
          </div>
          <div className="resource-row">
            <span>网络</span>
            <span className="resource-network">{metrics.network} KB/s</span>
          </div>
        </div>
      </div>

    </header>
  )
}
