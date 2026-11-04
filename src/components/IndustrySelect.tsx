import { useState, useEffect } from 'react'
import { listIndustries, selectIndustry, type IndustryMapping, type User } from '@/services/api'

interface IndustrySelectProps {
  user: User
  onSelected: (user: User) => void
}

export function IndustrySelect({ user, onSelected }: IndustrySelectProps) {
  const [industries, setIndustries] = useState<IndustryMapping[]>([])
  const [selectedId, setSelectedId] = useState<number | 'custom' | null>(user.industry_id || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // 自定义行业表单
  const [customIndustry, setCustomIndustry] = useState('')
  const [customPersona, setCustomPersona] = useState('')
  const [customContentType, setCustomContentType] = useState('')
  const [customAudience, setCustomAudience] = useState('')

  useEffect(() => {
    listIndustries().then(setIndustries).catch(() => setError('加载行业列表失败'))
  }, [])

  const handleConfirm = async () => {
    if (!selectedId) return
    setLoading(true)
    setError('')
    try {
      let updated: User
      if (selectedId === 'custom') {
        if (!customIndustry.trim()) {
          setError('请填写你的行业名称')
          setLoading(false)
          return
        }
        updated = await selectIndustry('custom', {
          industry: customIndustry,
          persona: customPersona,
          content_type: customContentType,
          target_audience: customAudience,
        })
      } else {
        updated = await selectIndustry(selectedId)
      }
      onSelected(updated)
    } catch (err: any) {
      setError(err.message || '保存失败')
    } finally {
      setLoading(false)
    }
  }

  const selected = selectedId === 'custom'
    ? {
        id: 0,
        industry: customIndustry || '（自定义行业）',
        persona: customPersona || '行业从业者，会分享专业经验和日常',
        content_type: customContentType || '经验分享 + 日常记录',
        target_audience: customAudience || '对该行业感兴趣的人群',
        created_at: '',
      }
    : industries.find(i => i.id === selectedId)

  return (
    <div className="industry-page">
      <div className="industry-card">
        <h1 className="industry-title">选择你的行业</h1>
        <p className="industry-hint">
          我们将根据你的行业，自动生成专属的内容工作流与人设定位。
        </p>

        {error && <div className="industry-error">{error}</div>}

        <div className="industry-grid">
          {industries.map((ind) => (
            <button
              key={ind.id}
              type="button"
              className={`industry-item ${selectedId === ind.id ? 'selected' : ''}`}
              onClick={() => setSelectedId(ind.id)}
            >
              <span className="industry-item-name">{ind.industry}</span>
              <span className="industry-item-type">{ind.content_type}</span>
            </button>
          ))}
          {/* 其他 / 自定义行业 */}
          <button
            type="button"
            className={`industry-item industry-item-other ${selectedId === 'custom' ? 'selected' : ''}`}
            onClick={() => setSelectedId('custom')}
          >
            <span className="industry-item-name">其他 / 自定义</span>
            <span className="industry-item-type">没有你的行业？自己填</span>
          </button>
        </div>

        {/* 自定义行业输入区 */}
        {selectedId === 'custom' && (
          <div className="industry-custom">
            <p className="custom-tip">
              💡 行业描述越清晰，生成的选题和文案效果越好。比如写清「卖什么、卖给谁、有什么特色」。
            </p>
            <label className="auth-field">
              <span>行业名称 <em className="required">*</em></span>
              <input
                type="text"
                value={customIndustry}
                onChange={(e) => setCustomIndustry(e.target.value)}
                placeholder="例如：手工烘焙工作室"
              />
            </label>
            <label className="auth-field">
              <span>人设定位（选填）</span>
              <input
                type="text"
                value={customPersona}
                onChange={(e) => setCustomPersona(e.target.value)}
                placeholder="例如：热爱烘焙的店主，会分享配方和制作过程"
              />
            </label>
            <label className="auth-field">
              <span>内容类型（选填）</span>
              <input
                type="text"
                value={customContentType}
                onChange={(e) => setCustomContentType(e.target.value)}
                placeholder="例如：制作过程 + 成品展示"
              />
            </label>
            <label className="auth-field">
              <span>目标人群（选填）</span>
              <input
                type="text"
                value={customAudience}
                onChange={(e) => setCustomAudience(e.target.value)}
                placeholder="例如：喜欢在家做烘焙的爱好者"
              />
            </label>
          </div>
        )}

        {selected && (
          <div className="industry-preview">
            <h3>定位预览</h3>
            <div className="preview-row">
              <span className="preview-label">行业</span>
              <span className="preview-value">{selected.industry}</span>
            </div>
            <div className="preview-row">
              <span className="preview-label">人设</span>
              <span className="preview-value">{selected.persona}</span>
            </div>
            <div className="preview-row">
              <span className="preview-label">内容类型</span>
              <span className="preview-value">{selected.content_type}</span>
            </div>
            <div className="preview-row">
              <span className="preview-label">目标人群</span>
              <span className="preview-value">{selected.target_audience}</span>
            </div>
          </div>
        )}

        <button
          type="button"
          className="industry-confirm"
          onClick={handleConfirm}
          disabled={!selectedId || loading}
        >
          {loading ? '保存中…' : user.industry_id ? '更换行业' : '确认并进入工作台'}
        </button>
      </div>
    </div>
  )
}
