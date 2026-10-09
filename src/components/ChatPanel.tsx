import { useState, useRef, useEffect } from 'react'
import {
  generateScript,
  ROLE_DEFINITIONS,
  DEFAULT_TENANT,
  DEFAULT_ACCOUNT,
  createConversation,
  createTopic,
  createScript,
  createActivity,
  type Role,
} from '@/services/api'
import {
  createEmptyPipeline,
  runStage,
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  canRunStage,
  getNextStage,
  type PipelineState,
  type PipelineStageId,
} from '@/services/pipeline'
import type { Agent } from '@/types/agent'

interface ChatMessage {
  id: string
  from: 'user' | 'agent'
  text: string
  time: string
  artifact?: { type: string; data: any }
  pipelineError?: { stageId: string; userInput: string }
}

interface ChatPanelProps {
  agent: Agent
  onClose: () => void
}

function nowText() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function ChatPanel({ agent, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pipeline, setPipeline] = useState<PipelineState>(createEmptyPipeline())
  const scrollRef = useRef<HTMLDivElement>(null)

  const roleDef = ROLE_DEFINITIONS[agent.id]
  const role: Role = {
    id: agent.id,
    title: roleDef?.title || agent.name,
    shortDuty: roleDef?.shortDuty || '',
    publishedVersion: 'v1.0',
    publishedSummary: roleDef?.shortDuty || '',
  }

  const isDirector = agent.id === 'content-director'

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')

    if (isDirector && pipeline.active) {
      const stageId = pipeline.currentStage
      if (!canRunStage(pipeline, stageId)) {
        addMessage('agent', '上一阶段还没完成，请先完成或跳过上一阶段。')
        return
      }
      setLoading(true)
      addMessage('user', text)
      const result = await runStage({
        pipeline,
        stageId,
        userInput: text,
        tenant: DEFAULT_TENANT,
        account: DEFAULT_ACCOUNT,
        role,
        onUpdate: setPipeline,
      })
      if (result.success) {
        const stage = pipeline.stages[stageId]
        const summary = formatStageSummary(stageId, stage.output)
        addMessage('agent', summary, { type: stageId, data: stage.output })
        // 自动入库
        saveStageOutput(stageId, stage.output)
        const next = getNextStage(stageId)
        if (next) {
          setPipeline((p) => ({ ...p, currentStage: next! }))
        }
      } else {
        addMessage('agent', `${PIPELINE_STAGE_LABELS[stageId]}生成失败：${result.error}`, undefined, {
          stageId,
          userInput: text,
        })
      }
      setLoading(false)
      return
    }

    // 普通对话
    setLoading(true)
    addMessage('user', text)
    try {
      const result = await generateScript({
        tenant: DEFAULT_TENANT,
        account: DEFAULT_ACCOUNT,
        role,
        requestText: text,
        actorRole: 'store',
      })
      addMessage('agent', result.content)
    } catch (error: any) {
      const friendlyError =
        error.name === 'AbortError'
          ? '生成超时，请重试。'
          : error.message === 'Failed to fetch'
            ? '网络连接失败，请检查网络后重试。'
            : error.message || '生成失败'
      addMessage('agent', `${roleDef?.title || agent.name}生成失败：${friendlyError}`)
    }
    setLoading(false)
  }

  const addMessage = (
    from: 'user' | 'agent',
    text: string,
    artifact?: { type: string; data: any },
    pipelineError?: { stageId: string; userInput: string },
  ) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}-${Math.random()}`,
        from,
        text,
        time: nowText(),
        artifact,
        pipelineError,
      },
    ])
  }

  // 流水线产物自动入库
  const saveStageOutput = (stageId: string, output: any) => {
    if (!output) return
    if (stageId === 'topic' && output.title) {
      createTopic({ title: output.title, content: JSON.stringify(output), status: '已完成' })
        .then(() => createActivity({ agent: agent.name, text: `创建了选题「${output.title}」` }))
        .catch(() => {})
    } else if (stageId === 'script' && (output.opening || output.rawText)) {
      const title = output.title || output.opening?.slice(0, 20) || '未命名脚本'
      createScript({ title, content: JSON.stringify(output), role: agent.name })
        .then(() => createActivity({ agent: agent.name, text: `生成了脚本「${title}」` }))
        .catch(() => {})
    }
  }

  const handleClose = () => {
    if (messages.length > 0) {
      createConversation({
        agent_id: agent.id,
        agent_name: agent.name,
        messages: messages.map(m => ({ from: m.from, text: m.text })),
      }).catch(() => {})
    }
    onClose()
  }

  const togglePipeline = () => {
    setPipeline((p) => ({
      ...p,
      active: !p.active,
      currentStage: 'topic',
    }))
  }

  const jumpToStage = (stageId: PipelineStageId) => {
    const stage = pipeline.stages[stageId]
    if (stage.status === 'done' || stage.status === 'pending') {
      setPipeline((p) => ({ ...p, currentStage: stageId }))
    }
  }

  const retryStage = (stageId: string, userInput: string) => {
    setPipeline((p) => {
      const newPipeline = { ...p }
      const stage = newPipeline.stages[stageId as PipelineStageId]
      if (stage) {
        stage.status = 'pending'
        stage.error = ''
      }
      newPipeline.currentStage = stageId as PipelineStageId
      return newPipeline
    })
    setTimeout(() => handleRetry(stageId as PipelineStageId, userInput), 0)
  }

  const handleRetry = async (stageId: PipelineStageId, userInput: string) => {
    setLoading(true)
    const result = await runStage({
      pipeline,
      stageId,
      userInput,
      tenant: DEFAULT_TENANT,
      account: DEFAULT_ACCOUNT,
      role,
      onUpdate: setPipeline,
    })
    if (result.success) {
      const stage = pipeline.stages[stageId]
      const summary = formatStageSummary(stageId, stage.output)
      addMessage('agent', summary, { type: stageId, data: stage.output })
      saveStageOutput(stageId, stage.output)
      const next = getNextStage(stageId)
      if (next) {
        setPipeline((p) => ({ ...p, currentStage: next! }))
      }
    } else {
      addMessage('agent', `${PIPELINE_STAGE_LABELS[stageId]}生成失败：${result.error}`, undefined, {
        stageId,
        userInput,
      })
    }
    setLoading(false)
  }

  return (
    <div className="chat-panel-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="chat-panel">
        <div className="chat-panel-header">
          <div className="chat-panel-title">
            <span className="chat-avatar" style={{ background: `#${agent.color.toString(16).padStart(6, '0')}` }}>
              {agent.name[0]}
            </span>
            <div>
              <strong>{agent.name} AI</strong>
              <p>{roleDef?.shortDuty || ''}</p>
            </div>
          </div>
          <button type="button" className="chat-close" onClick={handleClose}>✕</button>
        </div>

        {isDirector && (
          <div className="pipeline-bar">
            {pipeline.active ? (
              <>
                <div className="pipeline-stepper">
                  {PIPELINE_STAGES.map((stageId, index) => {
                    const stage = pipeline.stages[stageId]
                    const isActive = pipeline.currentStage === stageId
                    return (
                      <div key={stageId} className="pipeline-step-wrapper">
                        <button
                          type="button"
                          className={`pipeline-step ${isActive ? 'active' : ''} status-${stage.status}`}
                          onClick={() => jumpToStage(stageId)}
                        >
                          <span className="pipeline-step-dot">{index + 1}</span>
                          <span className="pipeline-step-label">{PIPELINE_STAGE_LABELS[stageId]}</span>
                        </button>
                        {index < PIPELINE_STAGES.length - 1 && <div className="pipeline-connector" />}
                      </div>
                    )
                  })}
                </div>
                <button type="button" className="pipeline-toggle" onClick={togglePipeline}>退出流水线</button>
              </>
            ) : (
              <button type="button" className="pipeline-toggle pipeline-enter" onClick={togglePipeline}>
                进入流水线模式（选题→脚本→分镜→运营方案）
              </button>
            )}
          </div>
        )}

        <div className="chat-messages" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="chat-empty">
              <p>你好，我是{agent.name} AI。</p>
              <p>{roleDef?.shortDuty || '有什么可以帮你的？'}</p>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`chat-message ${msg.from}`}>
              <div className="chat-bubble">
                <div className="chat-meta">{msg.from === 'user' ? '你' : `${agent.name} AI`} · {msg.time}</div>
                <div className={`chat-text ${msg.pipelineError ? 'error' : ''}`}>{msg.text}</div>
                {msg.pipelineError && (
                  <button
                    type="button"
                    className="pipeline-retry-btn"
                    onClick={() => retryStage(msg.pipelineError!.stageId, msg.pipelineError!.userInput)}
                  >
                    重试{PIPELINE_STAGE_LABELS[msg.pipelineError.stageId as PipelineStageId] || ''}阶段
                  </button>
                )}
                {msg.artifact && renderArtifact(msg.artifact.type, msg.artifact.data)}
              </div>
            </div>
          ))}
          {loading && (
            <div className="chat-message agent">
              <div className="chat-bubble">
                <div className="chat-meta">{agent.name} AI</div>
                <div className="chat-text">正在生成中…</div>
              </div>
            </div>
          )}
        </div>

        <div className="chat-input-area">
          <div className="chat-input-hint">
            {isDirector && pipeline.active
              ? `当前阶段：${PIPELINE_STAGE_LABELS[pipeline.currentStage]}。输入描述后点击发送。`
              : '输入你的需求，按 Enter 发送'}
          </div>
          <div className="chat-input-row">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="输入消息…"
              rows={1}
            />
            <button type="button" className="chat-send" onClick={handleSend} disabled={loading || !input.trim()}>
              发送
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatStageSummary(stageId: string, output: any): string {
  if (!output) return '生成完成。'
  if (output.rawText) return output.rawText.slice(0, 200)
  switch (stageId) {
    case 'topic':
      return `选题完成：${output.title || ''}`
    case 'script':
      return `脚本完成：${output.opening || ''}`.slice(0, 100)
    case 'storyboard':
      return `分镜完成：共 ${Array.isArray(output.shots) ? output.shots.length : 0} 个镜头`
    case 'plan':
      return `运营方案完成：${output.publishWindow || ''}`
    default:
      return '生成完成。'
  }
}

function renderArtifact(type: string, data: any) {
  if (!data) return null
  if (data.rawText) {
    return <div className="pipeline-card"><div className="pipeline-card-body"><pre>{data.rawText}</pre></div></div>
  }
  switch (type) {
    case 'topic':
      return (
        <div className="pipeline-card">
          <div className="pipeline-card-title">选题卡</div>
          <div className="pipeline-card-body">
            <div className="pipeline-field"><span className="pipeline-field-label">标题</span><span className="pipeline-field-value">{data.title || ''}</span></div>
            <div className="pipeline-field"><span className="pipeline-field-label">开头第一句话</span><span className="pipeline-field-value">{data.hook || ''}</span></div>
            <div className="pipeline-field"><span className="pipeline-field-label">目标人群</span><span className="pipeline-field-value">{data.audience || ''}</span></div>
            {Array.isArray(data.sellingPoints) && data.sellingPoints.length > 0 && (
              <div className="pipeline-field">
                <span className="pipeline-field-label">核心卖点</span>
                <ul className="pipeline-list">
                  {data.sellingPoints.map((p: string, i: number) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            )}
            <div className="pipeline-field"><span className="pipeline-field-label">平台适配</span><span className="pipeline-field-value">{data.platformFit || ''}</span></div>
          </div>
        </div>
      )
    case 'script':
      return (
        <div className="pipeline-card">
          <div className="pipeline-card-title">脚本</div>
          <div className="pipeline-card-body">
            <div className="pipeline-section"><strong>开场</strong><p>{data.opening || ''}</p></div>
            {Array.isArray(data.body) && data.body.map((s: any, i: number) => (
              <div key={i} className="pipeline-section"><strong>{s.section || ''}</strong><p>{s.text || ''}</p></div>
            ))}
            <div className="pipeline-section"><strong>结尾</strong><p>{data.ending || ''}</p></div>
          </div>
        </div>
      )
    case 'storyboard':
      return (
        <div className="pipeline-card">
          <div className="pipeline-card-title">分镜表</div>
          <div className="pipeline-card-body">
            <table className="storyboard-table">
              <thead>
                <tr>
                  <th>镜号</th><th>画面描述</th><th>时长</th><th>景别</th><th>运镜</th><th>字幕</th><th>口播</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(data.shots) && data.shots.map((s: any, i: number) => (
                  <tr key={i}>
                    <td className="shot-no">{s.no || i + 1}</td>
                    <td>{s.visual || ''}</td>
                    <td>{s.durationSec || ''}秒</td>
                    <td>{s.shotType || ''}</td>
                    <td>{s.cameraMove || ''}</td>
                    <td>{s.subtitle || ''}</td>
                    <td>{s.narration || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    case 'plan':
      return (
        <div className="pipeline-card">
          <div className="pipeline-card-title">运营方案</div>
          <div className="pipeline-card-body">
            <div className="pipeline-field"><span className="pipeline-field-label">发布时段</span><span className="pipeline-field-value">{data.publishWindow || ''}</span></div>
            {Array.isArray(data.hashtags) && data.hashtags.length > 0 && (
              <div className="pipeline-field">
                <span className="pipeline-field-label">话题标签</span>
                <div className="pipeline-tags">
                  {data.hashtags.map((t: string, i: number) => <span key={i} className="pipeline-tag">{t}</span>)}
                </div>
              </div>
            )}
            <div className="pipeline-field"><span className="pipeline-field-label">封面文字</span><span className="pipeline-field-value">{data.coverText || ''}</span></div>
            <div className="pipeline-field"><span className="pipeline-field-label">互动策略</span><span className="pipeline-field-value">{data.interaction || ''}</span></div>
            {Array.isArray(data.metrics) && data.metrics.length > 0 && (
              <div className="pipeline-field">
                <span className="pipeline-field-label">数据指标</span>
                <ul className="pipeline-list">
                  {data.metrics.map((m: string, i: number) => <li key={i}>{m}</li>)}
                </ul>
              </div>
            )}
            <div className="pipeline-field"><span className="pipeline-field-label">平台差异建议</span><span className="pipeline-field-value">{data.platformAdvice || ''}</span></div>
          </div>
        </div>
      )
    default:
      return null
  }
}
