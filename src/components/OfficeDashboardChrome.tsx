const NAV_ITEMS = [
  { icon: '⌂', label: '首页', active: true, badge: undefined },
  { icon: '▤', label: '任务中心', active: false, badge: 6 },
  { icon: '♙', label: '智能体', active: false, badge: undefined },
  { icon: '□', label: '文件中心', active: false, badge: undefined },
  { icon: '☆', label: '技能中心', active: false, badge: undefined },
  { icon: '◫', label: '浏览器助手', active: false, badge: undefined },
  { icon: '▱', label: '对话中心', active: false, badge: 3 },
  { icon: '□', label: '日程日历', active: false, badge: undefined },
  { icon: '♢', label: '通知中心', active: false, badge: 5 },
] as const

const STATS = [
  { label: '今日任务', value: '6', hint: '进行中', online: false },
  { label: '已完成', value: '13', hint: '今日完成', online: false },
  { label: '待处理', value: '2', hint: '阻塞事项', online: false },
  { label: 'AI 员工', value: '6/6', hint: '全部在线', online: true },
] as const

const TASKS = [
  { title: '市场调研', owner: '王明', progress: 72, tone: 'blue', status: '进行中' },
  { title: '文案撰写', owner: '陈书', progress: 60, tone: 'orange', status: '进行中' },
  { title: '合规审核', owner: '赵审', progress: 30, tone: 'purple', status: '进行中' },
  { title: '打包汇报', owner: '刘市', progress: 0, tone: 'green', status: '等待开始' },
] as const

const ACTIVITIES = [
  { agent: '李研', text: '扫描信息源', time: '09:42' },
  { agent: '陈书', text: '起草标书章节', time: '09:38' },
  { agent: '王明', text: '等待主管签批', time: '09:31' },
  { agent: '赵审', text: '检查合规条目', time: '09:24' },
] as const

const WORKSPACES = ['我的空间', '市场部空间', '产品部空间', '运营部空间'] as const

const QUICK_TOOLS = [
  { icon: '□', label: '文件浏览' },
  { icon: '◎', label: '打开浏览器' },
  { icon: '⌗', label: '截图 OCR' },
  { icon: '♩', label: '语音输入' },
] as const

const TOOLBAR_ITEMS = [
  { icon: 'Ⅱ', label: '全部暂停', primary: false },
  { icon: '▶', label: '全部继续', primary: false },
  { icon: '◷', label: '任务调度', primary: false },
  { icon: '□', label: '安排会议', primary: false },
  { icon: '+', label: '新建任务', primary: true },
  { icon: '⇩', label: '导出日报', primary: false },
] as const

export function OfficeSidebar() {
  return (
    <aside className="office-sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark">⬢</span>
        <span>AI Office</span>
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
            className={`nav-item ${item.active ? 'active' : ''}`}
          >
            <span className="nav-main">
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </span>
            {item.badge ? (
              <span className="nav-badge">{item.badge}</span>
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
          <span>本地运行正常</span>
          <span>☼</span>
        </div>
      </div>
    </aside>
  )
}

export function OfficeHeaderStats() {
  return (
    <header className="office-header-stats">
      {STATS.map((stat) => (
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
          <span>CPU</span>
          <div className="resource-bar"><span style={{ width: '39%' }} /></div>
          <em>39%</em>
        </div>
        <div className="resource-row">
          <span>内存</span>
          <div className="resource-bar purple"><span style={{ width: '65%' }} /></div>
          <em>65%</em>
        </div>
        <div className="resource-row">
          <span>网络</span>
          <em className="network-value">15 KB/s</em>
        </div>
      </section>
    </header>
  )
}

export function OfficeRightPanel() {
  return (
    <aside className="office-right-panel">
      <section className="panel-section">
        <h2>当前任务流</h2>
        <div className="task-list">
          {TASKS.map((task) => (
            <article key={task.title} className="task-card">
              <div className="task-title-row">
                <strong>{task.title}</strong>
                <span className={task.status === '进行中' ? 'task-status active' : 'task-status'}>
                  {task.status}
                </span>
              </div>
              <p>{task.owner}</p>
              <div className="task-progress">
                <span className={`tone-${task.tone}`} style={{ width: `${task.progress}%` }} />
              </div>
              <em className="task-percent">{task.progress}%</em>
            </article>
          ))}
        </div>
      </section>

      <section className="panel-section panel-grow">
        <h2>实时动态</h2>
        <ul className="activity-list">
          {ACTIVITIES.map((activity) => (
            <li key={`${activity.agent}-${activity.time}`}>
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
            <button key={tool.label} type="button" className="quick-tool">
              <span>{tool.icon}</span>
              <strong>{tool.label}</strong>
            </button>
          ))}
        </div>
      </section>
    </aside>
  )
}

export function OfficeBottomToolbar() {
  return (
    <div className="office-bottom-toolbar">
      <div className="toolbar-inner">
        {TOOLBAR_ITEMS.map((item) => (
          <button
            key={item.label}
            type="button"
            className={`toolbar-btn ${item.primary ? 'primary' : ''}`}
          >
            <span className="toolbar-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
