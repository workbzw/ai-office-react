import {
  IconAgents,
  IconBell,
  IconBrowser,
  IconCalendar,
  IconChat,
  IconFolder,
  IconHexLogo,
  IconHome,
  IconSearch,
  IconSettings,
  IconSkill,
  IconTasks,
} from '@/components/icons'

const MAIN_NAV = [
  { icon: IconHome, label: '首页', active: true },
  { icon: IconTasks, label: '任务中心', badge: 6 },
  { icon: IconAgents, label: '智能体' },
  { icon: IconFolder, label: '文件中心' },
  { icon: IconSkill, label: '技能中心' },
  { icon: IconBrowser, label: '浏览器助手' },
  { icon: IconChat, label: '对话中心', badge: 3 },
  { icon: IconCalendar, label: '日程日历' },
  { icon: IconBell, label: '通知中心', badge: 5 },
] as const

const WORKSPACES = [
  { label: '我的空间', active: true, online: true },
  { label: '市场部空间' },
  { label: '产品部空间' },
  { label: '运营部空间' },
] as const

export function OfficeSidebar() {
  return (
    <aside className="office-sidebar">
      <div className="sidebar-top">
        <div className="sidebar-brand">
          <IconHexLogo />
          <span className="brand-name">AI Office</span>
        </div>

        <div className="sidebar-search">
          <IconSearch className="search-icon" />
          <input type="text" placeholder="搜索功能、任务、员工…" readOnly />
          <kbd className="search-kbd">⌘K</kbd>
        </div>

        <nav className="sidebar-nav">
          {MAIN_NAV.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.label}
                type="button"
                className={`nav-item ${'active' in item && item.active ? 'active' : ''}`}
              >
                <Icon className="nav-icon-svg" />
                <span className="nav-label">{item.label}</span>
                {'badge' in item && item.badge != null && (
                  <span className="nav-badge">{item.badge}</span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="sidebar-workspaces">
        <p className="section-title">工作空间</p>
        {WORKSPACES.map((ws) => (
          <button
            key={ws.label}
            type="button"
            className={`nav-item workspace-item ${'active' in ws && ws.active ? 'active' : ''}`}
          >
            {'online' in ws && ws.online ? (
              <span className="workspace-dot" aria-hidden />
            ) : (
              <span className="workspace-dot-spacer" aria-hidden />
            )}
            <span className="nav-label">{ws.label}</span>
          </button>
        ))}
      </div>

      <div className="sidebar-footer">
        <div className="user-card">
          <div className="user-avatar">T</div>
          <div className="user-info">
            <span className="user-name">Teejoo</span>
            <span className="user-status">
              <span className="status-dot online" aria-hidden />
              在线
            </span>
          </div>
        </div>
        <div className="system-status">
          <span className="status-dot online" aria-hidden />
          <span>本地运行正常</span>
          <button type="button" className="settings-btn" aria-label="设置">
            <IconSettings size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}
