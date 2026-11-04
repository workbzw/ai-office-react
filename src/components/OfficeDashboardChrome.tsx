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
  type User,
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

export type NavKey = typeof NAV_ITEMS[number]['label']

interface SidebarProps {
  active: NavKey
  onNavigate: (key: NavKey) => void
  unreadNotifications: number
  user?: User | null
  onLogout?: () => void
  onWorkbench?: () => void
}

export function OfficeSidebar({ active, onNavigate, unreadNotifications, user, onLogout, onWorkbench }: SidebarProps) {
  const userName = user?.name || 'Teejoo'
  const avatarChar = userName.charAt(0).toUpperCase()
  const userIndustry = user?.industry || ''

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

      {/* 工作台入口 */}
      <button
        type="button"
        className="nav-item workbench-entry"
        onClick={onWorkbench}
      >
        <span className="nav-main">
          <span className="nav-icon">⚡</span>
          <span>工作台</span>
        </span>
      </button>

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
          <span className="user-avatar">{avatarChar}</span>
          <span>
            <strong>{userName}</strong>
            <em><span className="agent-dot online" />{userIndustry || '在线'}</em>
          </span>
          {onLogout && (
            <button type="button" className="logout-btn" onClick={onLogout} title="退出登录">
              退出
            </button>
          )}
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
  onSubmit?: (text: string) => void
}

export function OfficeBottomToolbar({ onAction, onSubmit }: BottomToolbarProps) {
  const [taskText, setTaskText] = useState('')
  const [combo, setCombo] = useState('省心组合')

  const handleSubmit = () => {
    const text = taskText.trim()
    if (!text) return
    onSubmit?.(text)
    setTaskText('')
  }

  return (
    <div className="office-bottom-toolbar">
      <div className="task-input-bar">
        <textarea
          className="task-input-main"
          placeholder="请输入任务，交给我来帮你完成"
          value={taskText}
          onChange={(e) => setTaskText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          rows={1}
        />
        <div className="task-input-footer">
          <div className="task-input-left">
            <button
              type="button"
              className="task-file-btn"
              onClick={() => onAction?.('upload')}
            >
              <span className="task-file-icon">+</span>
              <span>选择文件</span>
            </button>
          </div>
          <div className="task-input-right">
            <select
              className="task-combo-select"
              value={combo}
              onChange={(e) => setCombo(e.target.value)}
            >
              <option value="省心组合">省心组合</option>
              <option value="快速出稿">快速出稿</option>
              <option value="深度创作">深度创作</option>
              <option value="精准投放">精准投放</option>
            </select>
            <button
              type="button"
              className="task-send-btn"
              onClick={handleSubmit}
              disabled={!taskText.trim()}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5" />
                <path d="M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>
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
