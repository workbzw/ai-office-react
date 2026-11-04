import { useState, useEffect } from 'react'
import { listDailyIdeas, generateDailyIdeas, type DailyIdea, type User } from '@/services/api'

interface WorkbenchProps {
  user: User
  onBackToOffice: () => void
}

export function Workbench({ user, onBackToOffice }: WorkbenchProps) {
  const [ideas, setIdeas] = useState<DailyIdea[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadIdeas()
  }, [])

  const loadIdeas = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await listDailyIdeas()
      setIdeas(res.ideas || [])
    } catch (err: any) {
      setError(err.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    try {
      const res = await generateDailyIdeas()
      setIdeas(res.ideas || [])
    } catch (err: any) {
      setError(err.message || '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="workbench-page">
      <div className="workbench-header">
        <div>
          <h1>工作台</h1>
          <p className="workbench-user">
            {user.name} · {user.industry || '未选择行业'}
          </p>
        </div>
        <button type="button" className="workbench-back" onClick={onBackToOffice}>
          返回办公室
        </button>
      </div>

      <div className="workbench-userinfo">
        <div className="userinfo-card">
          <span className="userinfo-label">人设</span>
          <span className="userinfo-value">{user.persona || '—'}</span>
        </div>
        <div className="userinfo-card">
          <span className="userinfo-label">内容类型</span>
          <span className="userinfo-value">{user.content_type || '—'}</span>
        </div>
        <div className="userinfo-card">
          <span className="userinfo-label">目标人群</span>
          <span className="userinfo-value">{user.target_audience || '—'}</span>
        </div>
      </div>

      <div className="workbench-section">
        <div className="section-head">
          <h2>今日选题灵感</h2>
          <button
            type="button"
            className="generate-btn"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? '生成中…' : ideas.length > 0 ? '重新生成' : '生成今日选题灵感'}
          </button>
        </div>

        {error && <div className="wb-error">{error}</div>}

        {loading ? (
          <div className="wb-loading">
            <span className="chat-typing-dot" />
            <span className="chat-typing-dot" />
            <span className="chat-typing-dot" />
            <span className="chat-typing-hint">加载中</span>
          </div>
        ) : ideas.length === 0 ? (
          <div className="wb-empty">
            <p>还没有今日选题灵感</p>
            <p>点击「生成今日选题灵感」，系统将抓取热门内容并生成 10 条选题方向。</p>
          </div>
        ) : (
          <div className="ideas-list">
            {ideas.map((idea, idx) => (
              <div key={idea.id} className="idea-card">
                <div className="idea-head">
                  <span className="idea-rank">#{idx + 1}</span>
                  <span className="idea-title">{idea.video_title}</span>
                </div>
                <div className="idea-stats">
                  <span>👍 {idea.like_count.toLocaleString()}</span>
                  <span>⭐ {idea.favorite_count.toLocaleString()}</span>
                  <span>💬 {idea.comment_count.toLocaleString()}</span>
                </div>
                <div className="idea-tags">
                  {idea.tags.map((tag, i) => (
                    <span key={i} className="idea-tag">{tag}</span>
                  ))}
                </div>
                <div className="idea-body">
                  <div className="idea-field">
                    <span className="idea-label">内容总结</span>
                    <span className="idea-value">{idea.content_summary}</span>
                  </div>
                  <div className="idea-field">
                    <span className="idea-label">适配度</span>
                    <span className="idea-value">{idea.fit_reason}</span>
                  </div>
                  <div className="idea-field">
                    <span className="idea-label">改编角度</span>
                    <span className="idea-value">{idea.adapt_angle}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
