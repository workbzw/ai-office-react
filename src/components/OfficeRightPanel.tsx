import { useEffect, useRef, useState } from 'react'
import {
  IconFile,
  IconGlobe,
  IconMic,
  IconScan,
} from '@/components/icons'
import {
  INITIAL_ACTIVITIES,
  TASK_CARDS,
  type ActivityEntry,
} from '@/config/dashboardMock'
import type { Agent } from '@/types/agent'
import { useOfficeStore } from '@/store/officeStore'

const QUICK_TOOLS = [
  { icon: IconFile, label: '文件浏览' },
  { icon: IconGlobe, label: '打开浏览器' },
  { icon: IconScan, label: '截图 OCR' },
  { icon: IconMic, label: '语音输入' },
] as const

function formatTime(d = new Date()) {
  return d.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function agentActivityText(agent: Agent): string | null {
  if (agent.mission?.kind === 'desk_visit') {
    const phase = agent.mission.phase
    if (phase === 'goto') return `${agent.name} 正在交接递送`
    if (phase === 'talk') return `${agent.name} 正在交接对话`
    if (phase === 'return') return `${agent.name} 交接收尾中`
  }
  const map: Record<string, string> = {
    walking: `${agent.name} 移动中`,
    talking: `${agent.name} 交接同步中`,
    working: `${agent.name} 处理任务`,
    thinking: `${agent.name} 规划交接中`,
  }
  return map[agent.state] ?? null
}

export function OfficeRightPanel() {
  const agents = useOfficeStore((s) => s.agents)
  const tick = useOfficeStore((s) => s.tick)
  const prevStates = useRef<Map<string, string>>(new Map())
  const [activities, setActivities] =
    useState<ActivityEntry[]>(INITIAL_ACTIVITIES)

  useEffect(() => {
    if (tick === 0) return

    const now = formatTime()
    const newEntries: ActivityEntry[] = []

    for (const agent of agents) {
      const key = `${agent.state}:${agent.currentTask ?? ''}:${agent.mission?.phase ?? ''}`
      const prev = prevStates.current.get(agent.id)
      if (prev === key) continue
      prevStates.current.set(agent.id, key)

      const text = agentActivityText(agent)
      if (text) {
        newEntries.push({
          id: `${agent.id}-${tick}`,
          agent: agent.name,
          action: text.replace(`${agent.name} `, ''),
          time: now,
        })
      }
    }

    if (newEntries.length > 0) {
      setActivities((prev) => [...newEntries, ...prev].slice(0, 12))
    }
  }, [agents, tick])

  return (
    <aside className="office-right-panel">
      <section className="panel-section">
        <h2 className="panel-title">当前任务流</h2>
        <div className="task-cards">
          {TASK_CARDS.map((task) => (
            <article
              key={task.id}
              className={`task-card theme-${task.theme}`}
            >
              <div className="task-card-head">
                <h3>{task.title}</h3>
                <span className={`task-status status-${task.status === '进行中' ? 'active' : 'wait'}`}>
                  {task.status}
                </span>
              </div>
              <p className="task-assignee">{task.assignee}</p>
              <div className="task-progress-row">
                <div className="task-progress-bar">
                  <div
                    className="task-progress-fill"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
                <span className="task-progress-pct">{task.progress}%</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel-section panel-section-grow">
        <h2 className="panel-title">实时动态</h2>
        <ul className="activity-feed">
          {activities.map((entry) => (
            <li key={entry.id} className="activity-item">
              <span className="activity-dot" aria-hidden />
              <div className="activity-body">
                <p>
                  <strong>{entry.agent}</strong> {entry.action}
                </p>
                <time>{entry.time}</time>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel-section">
        <h2 className="panel-title">快捷工具</h2>
        <div className="quick-tools">
          {QUICK_TOOLS.map((tool) => {
            const Icon = tool.icon
            return (
              <button key={tool.label} type="button" className="quick-tool-btn">
                <Icon />
                <span>{tool.label}</span>
              </button>
            )
          })}
        </div>
      </section>
    </aside>
  )
}
