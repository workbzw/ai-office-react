import { useState } from 'react'
import { OfficeActionConnector } from '@/components/OfficeActionConnector'
import { OfficeCanvas } from '@/components/OfficeCanvas'
import {
  OfficeBottomToolbar,
  OfficeHeaderStats,
  OfficeRightPanel,
  OfficeSidebar,
  useUnreadNotifications,
  type NavKey,
} from '@/components/OfficeDashboardChrome'
import { ChatPanel } from '@/components/ChatPanel'
import { ResourcePanel, type ResourceKey } from '@/components/ResourcePanel'
import type { Agent } from '@/types/agent'
import './App.css'

const RESOURCE_KEYS: NavKey[] = ['选题库', '脚本库', '素材中心', '对话记录', '通知', '智能体']

function App() {
  const [chatAgent, setChatAgent] = useState<Agent | null>(null)
  const [activeNav, setActiveNav] = useState<NavKey>('首页')
  const unreadCount = useUnreadNotifications()

  const isResourceView = RESOURCE_KEYS.includes(activeNav)

  const handleNavigate = (key: NavKey) => {
    setActiveNav(key)
  }

  return (
    <div className="office-app">
      <OfficeActionConnector />
      <OfficeSidebar
        active={activeNav}
        onNavigate={handleNavigate}
        unreadNotifications={unreadCount}
      />
      <div className="office-center">
        <OfficeHeaderStats />
        <main className="office-main">
          {isResourceView ? (
            <ResourcePanel resource={activeNav as ResourceKey} onClose={() => setActiveNav('首页')} />
          ) : (
            <OfficeCanvas onOpenChat={setChatAgent} />
          )}
          {!isResourceView && <OfficeBottomToolbar />}
        </main>
      </div>
      <OfficeRightPanel />
      {chatAgent && <ChatPanel agent={chatAgent} onClose={() => setChatAgent(null)} />}
    </div>
  )
}

export default App
