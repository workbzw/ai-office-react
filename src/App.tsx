import { useState, useEffect } from 'react'
import { OfficeActionConnector } from '@/components/OfficeActionConnector'
import { OfficeCanvas } from '@/components/OfficeCanvas'
import {
  OfficeBottomToolbar,
  OfficeHeaderStats,
  OfficeSidebar,
  useUnreadNotifications,
  type NavKey,
} from '@/components/OfficeDashboardChrome'
import { ChatPanel } from '@/components/ChatPanel'
import { ResourcePanel, type ResourceKey } from '@/components/ResourcePanel'
import { AuthPage } from '@/components/AuthPage'
import { IndustrySelect } from '@/components/IndustrySelect'
import { Workbench } from '@/components/Workbench'
import { getStats, getMe, logout, createTask, type User } from '@/services/api'
import type { Agent } from '@/types/agent'
import './App.css'

const RESOURCE_KEYS: NavKey[] = ['选题库', '脚本库', '素材中心', '对话记录', '通知', '智能体']

interface AppProps {
  onReady?: () => void
}

function App({ onReady }: AppProps) {
  const [chatAgent, setChatAgent] = useState<Agent | null>(null)
  const [activeNav, setActiveNav] = useState<NavKey>('首页')
  const unreadCount = useUnreadNotifications()
  const [user, setUser] = useState<User | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [view, setView] = useState<'office' | 'workbench'>('office')

  // 启动时检查登录状态
  useEffect(() => {
    getMe()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setCheckingAuth(false))
  }, [])

  // 首次拉取统计成功或 2s 安全超时后，淡出 Marvis 风格启动加载器
  useEffect(() => {
    if (checkingAuth) return
    let dismissed = false
    const safe = window.setTimeout(() => {
      if (!dismissed) {
        dismissed = true
        onReady?.()
      }
    }, 2000)

    getStats()
      .catch(() => null)
      .finally(() => {
        if (dismissed) return
        dismissed = true
        window.clearTimeout(safe)
        requestAnimationFrame(() => onReady?.())
      })

    return () => window.clearTimeout(safe)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingAuth])

  const handleLogout = () => {
    logout()
    setUser(null)
    setView('office')
  }

  const isResourceView = RESOURCE_KEYS.includes(activeNav)

  const handleNavigate = (key: NavKey) => {
    setActiveNav(key)
    if (key === '首页') setView('office')
  }

  // 底部输入框提交任务
  const handleTaskSubmit = (text: string) => {
    createTask({
      title: text.slice(0, 50),
      owner: user?.name || '我',
      progress: 0,
      status: '等待开始',
      tone: 'blue',
    }).catch(() => {})
  }

  // 认证检查中：保留加载器
  if (checkingAuth) {
    return <div className="office-app" />
  }

  // 未登录：显示登录/注册页
  if (!user) {
    return <AuthPage onAuthSuccess={(u) => setUser(u)} />
  }

  // 已登录但未选择行业：显示行业选择页
  if (!user.industry) {
    return <IndustrySelect user={user} onSelected={(u) => setUser(u || user)} />
  }

  // 工作台视图
  if (view === 'workbench') {
    return (
      <div className="office-app">
        <OfficeSidebar
          active={activeNav}
          onNavigate={handleNavigate}
          unreadNotifications={unreadCount}
          user={user}
          onLogout={handleLogout}
          onWorkbench={() => setView('workbench')}
        />
        <div className="office-center">
          <OfficeHeaderStats />
          <main className="office-main">
            <Workbench user={user} onBackToOffice={() => setView('office')} />
          </main>
        </div>
      </div>
    )
  }

  // 办公室主视图
  return (
    <div className="office-app">
      <OfficeActionConnector />
      <OfficeSidebar
        active={activeNav}
        onNavigate={handleNavigate}
        unreadNotifications={unreadCount}
        user={user}
        onLogout={handleLogout}
        onWorkbench={() => setView('workbench')}
      />
      <div className="office-center">
        <OfficeHeaderStats />
        <main className="office-main">
          {isResourceView ? (
            <ResourcePanel resource={activeNav as ResourceKey} onClose={() => setActiveNav('首页')} />
          ) : (
            <OfficeCanvas onOpenChat={setChatAgent} />
          )}
          {!isResourceView && <OfficeBottomToolbar onSubmit={handleTaskSubmit} />}
        </main>
      </div>
      {chatAgent && <ChatPanel agent={chatAgent} onClose={() => setChatAgent(null)} />}
    </div>
  )
}

export default App
