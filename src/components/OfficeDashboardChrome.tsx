import { useEffect, useState } from 'react'
import {
  getStats,
  listTasks,
  listActivities,
  createTask,
  listNotifications,
  type Stats,
  type Task,
  type Activity,
} from '@/services/api'

const NAV_ITEMS = [
  { icon: '⌂', label: '首页' },
  { icon: '▤', label: '选题库' },
  { icon: '♙', label: '智能体' },
  { icon: '□', label: '脚本库' },
  { icon: '☆', label: '素材中心' },
  { icon: '▱', label: '对话记录' },
  { icon: '♢', label: '通知' },
] as const

const WORKSPACES = ['我的空间', '抖音空间', '小红书空间', '视频号空间'] as const

const QUICK_TOOLS = [
  { icon: '□', label: '上传素材' },
  { icon: '◎', label: '新建选题' },
  { icon: '⌗', label: '批量生成' },
  { icon: '♩', label: '语音输入' },
] as const

const TOOLBAR_ITEMS = [
  { icon: '▶', label: '全员开工', key: 'start' },
  { icon: 'Ⅱ', label: '全部暂停', key: 'pause' },
  { icon: '◷', label: '流水线', key: 'pipeline' },
  { icon: '□', label: '新建脚本', key: 'new-script' },
  { icon: '+', label: '新建任务', key: 'new-task' },
  { icon: '⇩', label: '导出日报', key: 'export' },
] as const

export type NavKey = typeof NAV_ITEMS[number]['label']

interface SidebarProps {
  active: NavKey
  onNavigate: (key: NavKey) => void
  unreadNotifications: number
}

export function OfficeSidebar({ active, onNavigate, unreadNotifications }: SidebarProps) {
  return (
    <aside className="office-sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark">⬢</span>
        <span>内容创作工作台</span>
      </div>

      <div className="sidebar-search">
        <span>⌕</span>
        <span>搜索功能、任务、员工…</span>
        <kbd>⌘K</kbd>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.label}
            type="button"
            className={`nav-item ${active === item.label ? 'active' : ''}`}
            onClick={() => onNavigate(item.label)}
          >
            <span className="nav-main">
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </span>
            {item.label === '通知' && unreadNotifications > 0 ? (
              <span className="nav-badge">{unreadNotifications}</span>
            ) : null}
          </button>
        ))}
      </nav>

      <div className="sidebar-section">
        <p className="section-title">工作空间</p>
        {WORKSPACES.map((workspace, index) => (
          <div
            key={workspace}
            className={`workspace-row ${index === 0 ? 'active' : ''}`}
          >
            {index === 0 ? <span className="agent-dot online" /> : <span className="dot-spacer" />}
            <span>{workspace}</span>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <div className="user-card">
          <span className="user-avatar">T</span>
          <span>
            <strong>Teejoo</strong>
            <em><span className="agent-dot online" />在线</em>
          </span>
        </div>
        <div className="system-status">
          <span className="agent-dot online" />
          <span>系统运行正常</span>
        </div>
      </div>
    </aside>
  )
}

export function OfficeHeaderStats() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    getStats().then(setStats).catch(() => {})
    const timer = setInterval(() => getStats().then(setStats).catch(() => {}), 30000)
    return () => clearInterval(timer)
  }, [])

  const cards = stats ? [
    { label: '今日选题', value: String(stats.todayTopics), hint: '进行中', online: false },
    { label: '已生成脚本', value: String(stats.todayScripts), hint: '今日完成', online: false },
    { label: '待拍摄', value: String(stats.pendingTasks), hint: '阻塞事项', online: false },
    { label: 'AI 员工', value: '4/4', hint: '全部在线', online: true },
  ] : [
    { label: '今日选题', value: '—', hint: '加载中', online: false },
    { label: '已生成脚本', value: '—', hint: '加载中', online: false },
    { label: '待拍摄', value: '—', hint: '加载中', online: false },
    { label: 'AI 员工', value: '4/4', hint: '全部在线', online: true },
  ]

  return (
    <header className="office-header-stats">
      {cards.map((stat) => (
        <section key={stat.label} className="stat-card">
          <span className="stat-label">{stat.label}</span>
          <strong className="stat-value">{stat.value}</strong>
          <span className={`stat-hint ${stat.online ? 'online-hint' : ''}`}>
            {stat.online ? <span className="agent-dot online" /> : null}
            {stat.hint}
          </span>
        </section>
      ))}
      <section className="stat-card resource-card">
        <span className="stat-label">系统资源</span>
        <div className="resource-row">
          <span>选题</span>
          <em>{stats?.totalTopics ?? 0}</em>
        </div>
        <div className="resource-row">
          <span>脚本</span>
          <em>{stats?.totalScripts ?? 0}</em>
        </div>
        <div className="resource-row">
          <span>素材</span>
          <em>{stats?.totalMaterials ?? 0}</em>
        </div>
      </section>
    </header>
  )
}

interface RightPanelProps {
  onToolbarAction?: (key: string) => void
}

export function OfficeRightPanel({ onToolbarAction }: RightPanelProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [newTaskTitle, setNewTaskTitle] = useState('')

  const refresh = () => {
    listTasks().then(setTasks).catch(() => {})
    listActivities().then(setActivities).catch(() => {})
  }

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 15000)
    return () => clearInterval(timer)
  }, [])

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return
    try {
      await createTask({
        title: newTaskTitle.trim(),
        owner: '待分配',
        progress: 0,
        status: '等待开始',
        tone: 'blue',
      })
      setNewTaskTitle('')
      refresh()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <aside className="office-right-panel">
      <section className="panel-section">
        <h2>当前任务流</h2>
        <div className="task-input-row">
          <input
            type="text"
            placeholder="新建任务…"
            value={newTaskTitle}
            onChange={e => setNewTaskTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateTask()}
          />
          <button onClick={handleCreateTask}>+</button>
        </div>
        <div className="task-list">
          {tasks.length === 0 ? (
            <p className="empty-hint">暂无任务，点击上方创建</p>
          ) : tasks.slice(0, 8).map((task) => (
            <article key={task.id} className="task-card">
              <div className="task-title-row">
                <strong>{task.title}</strong>
                <span className={task.status === '进行中' ? 'task-status active' : 'task-status'}>
                  {task.status}
                </span>
              </div>
              <p>{task.owner}</p>
              <div className="task-progress">
                <span className={`tone-${task.tone || 'blue'}`} style={{ width: `${task.progress || 0}%` }} />
              </div>
              <em className="task-percent">{task.progress || 0}%</em>
            </article>
          ))}
        </div>
      </section>

      <section className="panel-section panel-grow">
        <h2>实时动态</h2>
        <ul className="activity-list">
          {activities.length === 0 ? (
            <li className="empty-hint">暂无动态</li>
          ) : activities.slice(0, 12).map((activity) => (
            <li key={activity.id}>
              <span className="activity-dot" />
              <p>
                <strong>{activity.agent}</strong> {activity.text}
                <time>{activity.time}</time>
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel-section">
        <h2>快捷工具</h2>
        <div className="quick-tools">
          {QUICK_TOOLS.map((tool) => (
            <button
              key={tool.label}
              type="button"
              className="quick-tool"
              onClick={() => onToolbarAction?.(tool.label)}
            >
              <span>{tool.icon}</span>
              <strong>{tool.label}</strong>
            </button>
          ))}
        </div>
      </section>
    </aside>
  )
}

interface BottomToolbarProps {
  onAction?: (key: string) => void
}

export function OfficeBottomToolbar({ onAction }: BottomToolbarProps) {
  return (
    <div className="office-bottom-toolbar">
      <div className="toolbar-inner">
        {TOOLBAR_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`toolbar-btn ${item.key === 'new-task' ? 'primary' : ''}`}
            onClick={() => onAction?.(item.key)}
          >
            <span className="toolbar-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// hook: 获取未读通知数
export function useUnreadNotifications() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const fetchCount = () => {
      listNotifications()
        .then(items => setCount(items.filter(n => !n.read).length))
        .catch(() => {})
    }
    fetchCount()
    const timer = setInterval(fetchCount, 30000)
    return () => clearInterval(timer)
  }, [])
  return count
}
