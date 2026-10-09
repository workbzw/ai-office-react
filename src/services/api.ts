// API 服务层：对接后端 /api/generate-script 和 /api/pipeline-stage

const API_BASE = '/api'

export interface Tenant {
  id: string
  name: string
  businessUnitName: string
}

export interface Account {
  id: string
  name: string
  platform: string
  stage: string
}

export interface Role {
  id: string
  title: string
  shortDuty?: string
  forbidden?: string[]
  publishedVersion?: string
  publishedSummary?: string
  sessionMaterials?: string
  recentMessages?: { from: string; text: string }[]
}

export interface GenerateScriptParams {
  tenant: Tenant
  account: Account
  role: Role
  requestText: string
  actorRole?: 'admin' | 'agent' | 'store'
  modelProvider?: 'doubao' | 'deepseek'
}

export async function generateScript(params: GenerateScriptParams): Promise<{ content: string; model: string }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 55000)

  try {
    const response = await fetch(`${API_BASE}/generate-script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        tenant: params.tenant,
        account: params.account,
        role: params.role,
        requestText: params.requestText,
        actorRole: params.actorRole || 'store',
      }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.message || '生成失败')
    }
    return { content: data.content || '', model: data.model || '' }
  } finally {
    clearTimeout(timeout)
  }
}

export interface PipelineStageParams {
  stage: 'topic' | 'script' | 'storyboard' | 'plan'
  input: string
  userInput?: string
  tenant: Tenant
  account: Account
  role: Role
  sessionMaterials?: string
}

export async function runPipelineStage(params: PipelineStageParams): Promise<{ output: any; rawText: string; model: string }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 55000)

  try {
    const response = await fetch(`${API_BASE}/pipeline-stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        stage: params.stage,
        input: params.input,
        userInput: params.userInput || '',
        tenant: params.tenant,
        account: params.account,
        role: params.role,
        sessionMaterials: params.sessionMaterials || '',
      }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.message || '流水线阶段生成失败')
    }
    return { output: data.output, rawText: data.rawText, model: data.model }
  } finally {
    clearTimeout(timeout)
  }
}

// 角色定义
export const ROLE_DEFINITIONS: Record<string, { title: string; shortDuty: string }> = {
  'content-director': {
    title: '编导',
    shortDuty: '把选题、卖点和案例整理成门店能看懂、能直接拍摄的内容脚本。',
  },
  'media-buyer': {
    title: '投手',
    shortDuty: '围绕投放，整理预算思路、投放建议、测试注意点和结果回传口径。',
  },
  'account-starter': {
    title: '运营',
    shortDuty: '根据业务情况和账号阶段，规划账号先做什么、发什么节奏、如何小步测试。',
  },
  'case-researcher': {
    title: '同行拆解',
    shortDuty: '整理同行案例与平台表现，判断哪些做法可以参考、哪些不能照搬。',
  },
}

// 默认商家/账号（前端演示用，实际可由用户选择）
export const DEFAULT_TENANT: Tenant = {
  id: 'default-tenant',
  name: '默认商家',
  businessUnitName: '内容创作',
}

export const DEFAULT_ACCOUNT: Account = {
  id: 'default-account',
  name: '默认账号',
  platform: '抖音',
  stage: '起号',
}

// ============ 通用 CRUD 接口 ============

async function crudRequest<T = any>(
  resource: string,
  method: string,
  data?: any,
  id?: number
): Promise<T> {
  const url = id ? `${API_BASE}/${resource}?id=${id}` : `${API_BASE}/${resource}`
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined,
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.message || '请求失败')
  return result as T
}

// 统计
export interface Stats {
  todayTopics: number
  todayScripts: number
  pendingTasks: number
  totalTopics: number
  totalScripts: number
  totalTasks: number
  totalMaterials: number
  totalConversations: number
  unreadNotifications: number
}

export function getStats(): Promise<Stats> {
  return fetch(`${API_BASE}/stats`).then(r => r.json())
}

// 选题
export interface Topic {
  id: number
  title: string
  content?: string
  status?: string
  created_at: string
}
export const listTopics = () => crudRequest<Topic[]>('topics', 'GET')
export const createTopic = (data: Partial<Topic>) => crudRequest<Topic>('topics', 'POST', data)
export const updateTopic = (id: number, data: Partial<Topic>) => crudRequest<Topic>('topics', 'PUT', data, id)
export const deleteTopic = (id: number) => crudRequest('topics', 'DELETE', undefined, id)

// 脚本
export interface Script {
  id: number
  title: string
  content?: string
  topic_id?: number
  role?: string
  created_at: string
}
export const listScripts = () => crudRequest<Script[]>('scripts', 'GET')
export const createScript = (data: Partial<Script>) => crudRequest<Script>('scripts', 'POST', data)
export const deleteScript = (id: number) => crudRequest('scripts', 'DELETE', undefined, id)

// 任务
export interface Task {
  id: number
  title: string
  owner?: string
  progress?: number
  status?: string
  tone?: string
  created_at: string
}
export const listTasks = () => crudRequest<Task[]>('tasks', 'GET')
export const createTask = (data: Partial<Task>) => crudRequest<Task>('tasks', 'POST', data)
export const updateTask = (id: number, data: Partial<Task>) => crudRequest<Task>('tasks', 'PUT', data, id)
export const deleteTask = (id: number) => crudRequest('tasks', 'DELETE', undefined, id)

// 活动
export interface Activity {
  id: number
  agent: string
  text: string
  time: string
  created_at: string
}
export const listActivities = () => crudRequest<Activity[]>('activities', 'GET')
export const createActivity = (data: Partial<Activity>) => crudRequest<Activity>('activities', 'POST', data)

// 素材
export interface Material {
  id: number
  name: string
  type?: string
  url?: string
  created_at: string
}
export const listMaterials = () => crudRequest<Material[]>('materials', 'GET')
export const createMaterial = (data: Partial<Material>) => crudRequest<Material>('materials', 'POST', data)
export const deleteMaterial = (id: number) => crudRequest('materials', 'DELETE', undefined, id)

// 对话记录
export interface Conversation {
  id: number
  agent_id: string
  agent_name?: string
  messages: { from: string; text: string }[]
  created_at: string
}
export const listConversations = () => crudRequest<Conversation[]>('conversations', 'GET')
export const createConversation = (data: Partial<Conversation>) => crudRequest<Conversation>('conversations', 'POST', data)
export const deleteConversation = (id: number) => crudRequest('conversations', 'DELETE', undefined, id)

// 通知
export interface Notification {
  id: number
  title: string
  content?: string
  read: boolean
  created_at: string
}
export const listNotifications = () => crudRequest<Notification[]>('notifications', 'GET')
export const markNotificationRead = (id: number) => crudRequest<Notification>('notifications', 'PUT', { read: true }, id)
export const deleteNotification = (id: number) => crudRequest('notifications', 'DELETE', undefined, id)

// 员工动作
export interface OfficeAction {
  type: 'desk_visit' | 'desk_visit_tour' | 'set_state'
  visitor?: number
  host?: number
  hosts?: number[]
  agentId?: string
  state?: string
  task?: string
  message?: string
}
export const listActions = (): Promise<(OfficeAction & { _id: number })[]> =>
  fetch(`${API_BASE}/actions`).then(r => r.json())
export const createAction = (data: OfficeAction) =>
  fetch(`${API_BASE}/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => r.json())
export const completeAction = (id: number) =>
  fetch(`${API_BASE}/actions?id=${id}`, { method: 'DELETE' }).then(r => r.json())
