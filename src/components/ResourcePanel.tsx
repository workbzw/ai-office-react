import { useEffect, useState } from 'react'
import {
  listTopics,
  createTopic,
  deleteTopic,
  listScripts,
  createScript,
  deleteScript,
  listMaterials,
  createMaterial,
  deleteMaterial,
  listConversations,
  deleteConversation,
  listNotifications,
  markNotificationRead,
  deleteNotification,
  type Topic,
  type Script,
  type Material,
  type Conversation,
  type Notification,
} from '@/services/api'

export type ResourceKey = '选题库' | '脚本库' | '素材中心' | '对话记录' | '通知' | '智能体'

interface ResourcePanelProps {
  resource: ResourceKey
  onClose: () => void
}

export function ResourcePanel({ resource, onClose }: ResourcePanelProps) {
  const [topics, setTopics] = useState<Topic[]>([])
  const [scripts, setScripts] = useState<Script[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [inputValue, setInputValue] = useState('')

  const refresh = () => {
    if (resource === '选题库') listTopics().then(setTopics).catch(() => {})
    if (resource === '脚本库') listScripts().then(setScripts).catch(() => {})
    if (resource === '素材中心') listMaterials().then(setMaterials).catch(() => {})
    if (resource === '对话记录') listConversations().then(setConversations).catch(() => {})
    if (resource === '通知') listNotifications().then(setNotifications).catch(() => {})
  }

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 15000)
    return () => clearInterval(timer)
  }, [resource])

  const handleCreate = async () => {
    if (!inputValue.trim()) return
    try {
      if (resource === '选题库') {
        await createTopic({ title: inputValue.trim(), content: '', status: '待处理' })
      } else if (resource === '脚本库') {
        await createScript({ title: inputValue.trim(), content: '' })
      } else if (resource === '素材中心') {
        await createMaterial({ name: inputValue.trim(), type: 'link' })
      }
      setInputValue('')
      refresh()
    } catch (e) {
      console.error(e)
    }
  }

  const renderContent = () => {
    if (resource === '智能体') {
      return (
        <div className="resource-placeholder">
          <h3>AI 员工管理</h3>
          <p>点击场景中的员工即可开始对话</p>
          <div className="agent-grid">
            {['编导', '投手', '运营', '同行拆解'].map(name => (
              <div key={name} className="agent-card-mini">
                <span className="agent-avatar-sm">{name[0]}</span>
                <strong>{name}</strong>
                <em>在线</em>
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (resource === '选题库') {
      return (
        <>
          <div className="resource-create-row">
            <input
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="输入选题标题…"
            />
            <button onClick={handleCreate}>新建选题</button>
          </div>
          <div className="resource-list">
            {topics.length === 0 ? <p className="empty-hint">暂无选题</p> : topics.map(t => (
              <div key={t.id} className="resource-item">
                <div className="resource-item-main">
                  <strong>{t.title}</strong>
                  <em>{t.status || '待处理'}</em>
                  <span>{new Date(t.created_at).toLocaleString('zh-CN')}</span>
                </div>
                <button className="del-btn" onClick={() => deleteTopic(t.id).then(refresh)}>删除</button>
              </div>
            ))}
          </div>
        </>
      )
    }

    if (resource === '脚本库') {
      return (
        <>
          <div className="resource-create-row">
            <input
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="输入脚本标题…"
            />
            <button onClick={handleCreate}>新建脚本</button>
          </div>
          <div className="resource-list">
            {scripts.length === 0 ? <p className="empty-hint">暂无脚本</p> : scripts.map(s => (
              <div key={s.id} className="resource-item">
                <div className="resource-item-main">
                  <strong>{s.title}</strong>
                  <em>{s.role || '通用'}</em>
                  <span>{new Date(s.created_at).toLocaleString('zh-CN')}</span>
                </div>
                <button className="del-btn" onClick={() => deleteScript(s.id).then(refresh)}>删除</button>
              </div>
            ))}
          </div>
        </>
      )
    }

    if (resource === '素材中心') {
      return (
        <>
          <div className="resource-create-row">
            <input
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="输入素材名称或链接…"
            />
            <button onClick={handleCreate}>添加素材</button>
          </div>
          <div className="resource-list">
            {materials.length === 0 ? <p className="empty-hint">暂无素材</p> : materials.map(m => (
              <div key={m.id} className="resource-item">
                <div className="resource-item-main">
                  <strong>{m.name}</strong>
                  <em>{m.type || '素材'}</em>
                  <span>{new Date(m.created_at).toLocaleString('zh-CN')}</span>
                </div>
                <button className="del-btn" onClick={() => deleteMaterial(m.id).then(refresh)}>删除</button>
              </div>
            ))}
          </div>
        </>
      )
    }

    if (resource === '对话记录') {
      return (
        <div className="resource-list">
          {conversations.length === 0 ? <p className="empty-hint">暂无对话记录</p> : conversations.map(c => (
            <div key={c.id} className="resource-item">
              <div className="resource-item-main">
                <strong>{c.agent_name || c.agent_id}</strong>
                <em>{c.messages?.length || 0} 条消息</em>
                <span>{new Date(c.created_at).toLocaleString('zh-CN')}</span>
              </div>
              <button className="del-btn" onClick={() => deleteConversation(c.id).then(refresh)}>删除</button>
            </div>
          ))}
        </div>
      )
    }

    if (resource === '通知') {
      return (
        <div className="resource-list">
          {notifications.length === 0 ? <p className="empty-hint">暂无通知</p> : notifications.map(n => (
            <div key={n.id} className={`resource-item ${n.read ? '' : 'unread'}`}>
              <div className="resource-item-main">
                <strong>{n.title}</strong>
                <p>{n.content}</p>
                <span>{new Date(n.created_at).toLocaleString('zh-CN')}</span>
              </div>
              <div className="resource-item-actions">
                {!n.read && (
                  <button className="read-btn" onClick={() => markNotificationRead(n.id).then(refresh)}>已读</button>
                )}
                <button className="del-btn" onClick={() => deleteNotification(n.id).then(refresh)}>删除</button>
              </div>
            </div>
          ))}
        </div>
      )
    }

    return null
  }

  return (
    <div className="resource-panel">
      <div className="resource-panel-header">
        <h2>{resource}</h2>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      <div className="resource-panel-body">
        {renderContent()}
      </div>
    </div>
  )
}
