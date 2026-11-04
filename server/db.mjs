// 数据存储层：内存缓存 + Supabase Storage 持久化（降级时仅内存）
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET_NAME = 'app-data'
const DATA_FILE = 'data.json'
const JWT_SECRET = process.env.JWT_SECRET || 'dxplus-dev-secret-change-me'

let supabase = null
let useSupabase = false

// 内存数据存储
const memory = {
  topics: [],
  scripts: [],
  tasks: [],
  activities: [],
  materials: [],
  conversations: [],
  notifications: [],
  actions: [],
  users: [],
  industry_mappings: [],
  daily_ideas: [],
}

// 自增 ID
const idCounters = {
  topics: 1, scripts: 1, tasks: 1, activities: 1,
  materials: 1, conversations: 1, notifications: 1, actions: 1,
  users: 1, industry_mappings: 1, daily_ideas: 1,
}

// 默认行业映射（提示词要求：industry、persona、content_type、target_audience）
const DEFAULT_INDUSTRY_MAPPINGS = [
  {
    industry: '餐饮门店',
    persona: '接地气的门店老板，会聊食材新鲜度和顾客评价',
    content_type: '探店口播 + 店内实拍',
    target_audience: '周边 3 公里的上班族和家庭用户',
  },
  {
    industry: '美业美甲',
    persona: '懂审美的美甲师，会分享款式灵感和保养技巧',
    content_type: '款式展示 + 过程记录',
    target_audience: '18-35 岁爱美的女性用户',
  },
  {
    industry: '健身工作室',
    persona: '专业教练，会纠正动作和分享饮食建议',
    content_type: '动作教学 + 训练日常',
    target_audience: '想要减脂塑形的都市白领',
  },
  {
    industry: '母婴亲子',
    persona: '有经验的宝妈，会分享育儿心得和好物推荐',
    content_type: '育儿经验 + 亲子日常',
    target_audience: '0-6 岁孩子的妈妈群体',
  },
  {
    industry: '知识付费',
    persona: '干货型讲师，会拆解案例和提供可执行方法',
    content_type: '知识干货 + 案例拆解',
    target_audience: '想提升技能的职场人士',
  },
  {
    industry: '服装穿搭',
    persona: '会搭配的店主，会讲面料版型和显瘦技巧',
    content_type: '穿搭展示 + 单品测评',
    target_audience: '18-40 岁注重穿搭的女性',
  },
  {
    industry: '家居家装',
    persona: '懂生活的设计师，会分享收纳和装修避坑',
    content_type: '空间改造 + 好物分享',
    target_audience: '新房装修和旧房改造的业主',
  },
  {
    industry: '教育培训',
    persona: '耐心的老师，会拆解知识点和学习方法',
    content_type: '知识讲解 + 学习方法',
    target_audience: '学生家长和备考人群',
  },
  {
    industry: '本地生活服务',
    persona: '实在的服务者，会展示服务过程和客户反馈',
    content_type: '服务过程 + 客户见证',
    target_audience: '有本地服务需求的居民',
  },
  {
    industry: '宠物行业',
    persona: '爱宠物的店主，会分享养宠知识和用品测评',
    content_type: '萌宠日常 + 养宠科普',
    target_audience: '养猫养狗的宠物主',
  },
  {
    industry: '医疗健康',
    persona: '专业的医护人员，会科普健康知识和答疑',
    content_type: '健康科普 + 答疑解惑',
    target_audience: '关注健康养生的人群',
  },
  {
    industry: '三农乡村',
    persona: '朴实的农人，会展示乡村生活和农产品',
    content_type: '乡村日常 + 农产品展示',
    target_audience: '关注乡村和特产的消费者',
  },
]

// 邮箱规范化：统一去掉首尾空白并转小写，避免注册/登录因大小写或空格对不上
export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase()
}

// 密码哈希（加盐）
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(String(password), salt, 1000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const check = crypto.pbkdf2Sync(String(password), salt, 1000, 64, 'sha512').toString('hex')
  return hash === check
}

// 生成简单 JWT（HS256）
export function signToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 7 * 24 * 3600 * 1000 })).toString('base64url')
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${signature}`
}

export function verifyToken(token) {
  try {
    const [header, body, signature] = token.split('.')
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url')
    if (signature !== expected) return null
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
    if (payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

// 初始化 Supabase 客户端
try {
  if (SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
    useSupabase = true
  } else {
    console.log('[DB] Supabase not configured, using memory only')
  }
} catch (e) {
  console.log('[DB] Supabase init failed:', e.message)
  useSupabase = false
}

// 确保 bucket 存在
async function ensureBucket() {
  if (!useSupabase) return false
  try {
    const { data, error } = await supabase.storage.getBucket(BUCKET_NAME)
    if (error) {
      if (error.code === 'PGRST116' || error.statusCode === 404) {
        const { error: createErr } = await supabase.storage.createBucket(BUCKET_NAME, { public: false })
        if (createErr) {
          console.log('[DB] Create bucket failed:', createErr.message)
          return false
        }
        console.log('[DB] Bucket created')
      } else {
        console.log('[DB] Get bucket error:', error.message)
        return false
      }
    }
    return true
  } catch (e) {
    console.log('[DB] ensureBucket error:', e.message)
    return false
  }
}

// 从 Supabase Storage 加载数据
async function loadFromSupabase() {
  if (!useSupabase) return
  if (!(await ensureBucket())) return
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(DATA_FILE)
    if (error) {
      if (error.statusCode === 404) return // 文件不存在，首次运行
      console.log('[DB] Download error:', error.message)
      return
    }
    const text = await data.text()
    const loaded = JSON.parse(text)
    Object.assign(memory, loaded)
    for (const key of Object.keys(idCounters)) {
      const arr = memory[key] || []
      if (arr.length > 0) {
        const maxId = Math.max(...arr.map(i => i.id))
        idCounters[key] = maxId + 1
      }
    }
  } catch (e) {
    console.log('[DB] Load from Supabase failed:', e.message)
  }
}

// 异步保存队列：写操作修改内存后立即返回，保存异步执行不阻塞请求
let saveScheduled = false
function scheduleSave() {
  if (saveScheduled) return
  saveScheduled = true
  setImmediate(() => {
    saveScheduled = false
    doSave().catch(e => console.log('[DB] async save error:', e.message))
  })
}

async function doSave() {
  if (!useSupabase) return
  if (!(await ensureBucket())) return
  try {
    const json = JSON.stringify(memory)
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(DATA_FILE, json, { contentType: 'application/json', upsert: true })
    if (error) console.log('[DB] Save error:', error.message)
  } catch (e) {
    console.log('[DB] Save error:', e.message)
  }
}

// wait: true 时同步等待保存完成（用于注册等关键操作）
async function saveToSupabase(wait = false) {
  if (wait) {
    await doSave()
  } else {
    scheduleSave()
  }
}

// ===== 单用户文件存储（避免 data.json 的最终一致性/缓存延迟）=====
function userFilePath(email) {
  return `users/${Buffer.from(normalizeEmail(email)).toString('base64url')}.json`
}

async function saveUserFile(user) {
  if (!useSupabase) return
  if (!(await ensureBucket())) return
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(userFilePath(user.email), JSON.stringify(user), {
        contentType: 'application/json', upsert: true,
      })
    if (error) console.log('[DB] saveUserFile error:', error.message)
  } catch (e) {
    console.log('[DB] saveUserFile error:', e.message)
  }
}

async function loadUserFile(email) {
  if (!useSupabase) return null
  if (!(await ensureBucket())) return null
  try {
    const { data, error } = await supabase.storage.from(BUCKET_NAME).download(userFilePath(email))
    if (error) return null
    return JSON.parse(await data.text())
  } catch {
    return null
  }
}

// 只在冷启动时加载一次，避免并发请求互相覆盖
let dataLoaded = false
async function ensureLoaded() {
  if (dataLoaded) return
  dataLoaded = true
  await loadFromSupabase()
  // 若加载后行业映射仍为空（首次运行），保存默认行业
  if (!memory.industry_mappings || memory.industry_mappings.length === 0) {
    memory.industry_mappings = DEFAULT_INDUSTRY_MAPPINGS.map((item, idx) => ({
      id: idx + 1,
      ...item,
      created_at: new Date().toISOString(),
    }))
    idCounters.industry_mappings = memory.industry_mappings.length + 1
    await saveToSupabase()
  }
}

// 写操作前强制刷新：合并 Supabase 最新数据到内存（不覆盖内存中更新的条目）
async function refreshFromSupabase() {
  await ensureLoaded()
  // 下载最新数据，按 id 合并：Supabase 中有但内存中没有的条目补进来
  if (!useSupabase) return
  try {
    const { data, error } = await supabase.storage.from(BUCKET_NAME).download(DATA_FILE)
    if (error) return
    const loaded = JSON.parse(await data.text())
    for (const key of Object.keys(loaded)) {
      if (!Array.isArray(loaded[key])) continue
      const memArr = memory[key] || []
      const memIds = new Set(memArr.map(i => i.id))
      for (const item of loaded[key]) {
        if (!memIds.has(item.id)) memArr.push(item)
      }
      memory[key] = memArr
      // 更新 id 计数器
      if (idCounters[key] !== undefined) {
        const maxId = memArr.reduce((m, i) => Math.max(m, i.id || 0), 0)
        idCounters[key] = Math.max(idCounters[key], maxId + 1)
      }
    }
  } catch (e) {
    console.log('[DB] refresh error:', e.message)
  }
}

function genId(collection) {
  return idCounters[collection]++
}

export async function list(collection) {
  await ensureLoaded()
  return [...(memory[collection] || [])]
}

export async function get(collection, id) {
  await ensureLoaded()
  return (memory[collection] || []).find(item => item.id === id) || null
}

export async function create(collection, data) {
  await refreshFromSupabase()
  const item = {
    id: genId(collection),
    ...data,
    created_at: new Date().toISOString(),
  }
  if (!memory[collection]) memory[collection] = []
  memory[collection].push(item)
  await saveToSupabase(false)
  return item
}

export async function update(collection, id, data) {
  await refreshFromSupabase()
  const arr = memory[collection] || []
  const idx = arr.findIndex(item => item.id === id)
  if (idx === -1) return null
  arr[idx] = { ...arr[idx], ...data, updated_at: new Date().toISOString() }
  await saveToSupabase(false)
  return arr[idx]
}

export async function remove(collection, id) {
  await refreshFromSupabase()
  const arr = memory[collection] || []
  const idx = arr.findIndex(item => item.id === id)
  if (idx === -1) return false
  arr.splice(idx, 1)
  await saveToSupabase(false)
  return true
}

export async function getStats() {
  await ensureLoaded()
  const today = new Date().toDateString()
  const todayTopics = (memory.topics || []).filter(t =>
    new Date(t.created_at).toDateString() === today
  ).length
  const todayScripts = (memory.scripts || []).filter(s =>
    new Date(s.created_at).toDateString() === today
  ).length
  const pendingTasks = (memory.tasks || []).filter(t => t.status !== 'completed').length
  return {
    todayTopics, todayScripts, pendingTasks,
    totalTopics: (memory.topics || []).length,
    totalScripts: (memory.scripts || []).length,
    totalTasks: (memory.tasks || []).length,
    totalMaterials: (memory.materials || []).length,
    totalConversations: (memory.conversations || []).length,
    unreadNotifications: (memory.notifications || []).filter(n => !n.read).length,
  }
}

export async function addActivity(agent, text) {
  return create('activities', {
    agent, text,
    time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
  })
}

export async function addNotification(title, content) {
  return create('notifications', { title, content, read: false })
}

// ============ 用户认证相关 ============

export async function findUserByEmail(email) {
  await ensureLoaded()
  const normalized = normalizeEmail(email)
  const rawLower = String(email ?? '').toLowerCase()
  // 优先读取单用户文件（新建文件无缓存，避免最终一致性问题）
  // 兼容历史数据：早期注册可能把首尾空格一起写进了文件路径
  let fromFile = await loadUserFile(normalized)
  if (!fromFile && rawLower !== normalized) fromFile = await loadUserFile(rawLower)
  if (fromFile) {
    const arr = memory.users || []
    const i = arr.findIndex(u => normalizeEmail(u.email) === normalized)
    if (i === -1) arr.push(fromFile)
    else arr[i] = fromFile
    memory.users = arr
    return fromFile
  }
  // 兜底：内存（大小写与首尾空格不敏感）
  return (memory.users || []).find(u => normalizeEmail(u.email) === normalized) || null
}

export async function getUserById(id) {
  await ensureLoaded()
  let user = (memory.users || []).find(u => u.id === id)
  if (!user) {
    // 可能是其他实例创建的用户，刷新一次
    await refreshFromSupabase()
    user = (memory.users || []).find(u => u.id === id)
  }
  return user || null
}

export async function createUser({ email, password, name }) {
  await ensureLoaded()
  const normalized = normalizeEmail(email)
  const existing = await findUserByEmail(normalized)
  if (existing) {
    const err = new Error('该邮箱已注册')
    err.statusCode = 409
    throw err
  }
  const user = {
    id: genId('users'),
    email: normalized,
    password: hashPassword(password),
    name: name || normalized.split('@')[0],
    industry_id: null,
    industry: null,
    persona: null,
    content_type: null,
    target_audience: null,
    skill_instance: null,
    is_admin: normalized === 'admin@dxplus.xyz',
    created_at: new Date().toISOString(),
  }
  if (!memory.users) memory.users = []
  memory.users.push(user)
  await saveUserFile(user)      // 单用户文件：立即写入，供后续登录/选行业读取
  await saveToSupabase(false)   // data.json：异步更新
  return user
}

export async function updateUserIndustry(userId, email, industryMapping) {
  await ensureLoaded()
  let arr = memory.users || []
  let idx = arr.findIndex(u => u.id === userId)
  // 内存找不到时，直接读取该用户的单用户文件（避免 data.json 最终一致性延迟）
  if (idx === -1 && email) {
    const fromFile = await loadUserFile(email)
    if (fromFile) {
      arr.push(fromFile)
      memory.users = arr
      idx = arr.length - 1
    }
  }
  // 仍找不到：短暂重试等待 data.json 同步
  for (let attempt = 0; idx === -1 && attempt < 3; attempt++) {
    await new Promise(r => setTimeout(r, 600))
    await refreshFromSupabase()
    arr = memory.users || []
    idx = arr.findIndex(u => u.id === userId)
  }
  if (idx === -1) return null
  arr[idx] = {
    ...arr[idx],
    industry_id: industryMapping.id,
    industry: industryMapping.industry,
    persona: industryMapping.persona,
    content_type: industryMapping.content_type,
    target_audience: industryMapping.target_audience,
    updated_at: new Date().toISOString(),
  }
  await saveUserFile(arr[idx])   // 单用户文件：立即写入
  await saveToSupabase(true)     // data.json：同步更新
  return arr[idx]
}

// 去除密码字段的安全用户对象
export function sanitizeUser(user) {
  if (!user) return null
  const { password, ...safe } = user
  return safe
}

// ============ 行业映射 ============

export async function listIndustryMappings() {
  await ensureLoaded()
  return [...(memory.industry_mappings || [])]
}

// ============ 每日选题灵感（mock 生成） ============

const MOCK_IDEAS_TEMPLATES = [
  { video_title: '9.9 元就能吃到撑？这家店凭什么这么火', tags: ['性价比', '探店'], content_summary: '博主用低价策略吸引顾客，展示店内爆满场景' },
  { video_title: '老板亲自下厨，这道菜我吃了 10 年', tags: ['人情味', '招牌菜'], content_summary: '强调老板亲力亲为，主打情感共鸣' },
  { video_title: '排队 2 小时只为这一口，到底值不值', tags: ['排队', '测评'], content_summary: '用排队现象制造好奇心，给出真实测评' },
  { video_title: '隐藏菜单大公开，老顾客才知道的吃法', tags: ['隐藏菜单', '攻略'], content_summary: '分享独家吃法，制造信息差' },
  { video_title: '从路边摊到开分店，他只用了 3 年', tags: ['创业', '励志'], content_summary: '讲述创业故事，引发共鸣' },
  { video_title: '顾客说不好吃，老板当场免单', tags: ['服务', '自信'], content_summary: '用服务态度体现品质自信' },
  { video_title: '这家店只卖一样东西，却天天爆满', tags: ['单品', '爆款'], content_summary: '聚焦单品策略，展示产品力' },
  { video_title: '深夜 12 点还在排队的店，到底有什么魔力', tags: ['深夜', '好奇'], content_summary: '制造时间反差，引发好奇' },
  { video_title: '老板说不赚钱，结果开了 5 家分店', tags: ['反差', '经营'], content_summary: '用反差吸引注意，展示经营智慧' },
  { video_title: '一个人也能吃好的店，社恐福音', tags: ['一人食', '社恐'], content_summary: '针对特定人群痛点，营造归属感' },
]

export async function generateDailyIdeas(userId) {
  await ensureLoaded()
  const today = new Date().toISOString().slice(0, 10)
  // 检查今天是否已生成
  const existing = (memory.daily_ideas || []).filter(
    i => i.user_id === userId && i.generated_date === today
  )
  if (existing.length > 0) return existing

  const user = (memory.users || []).find(u => u.id === userId)
  const persona = user?.persona || '通用人设'
  const industry = user?.industry || '通用行业'

  const ideas = MOCK_IDEAS_TEMPLATES.map((tpl, idx) => ({
    id: genId('daily_ideas'),
    user_id: userId,
    video_title: tpl.video_title,
    like_count: Math.floor(Math.random() * 50000) + 1000,
    favorite_count: Math.floor(Math.random() * 10000) + 200,
    comment_count: Math.floor(Math.random() * 2000) + 50,
    tags: tpl.tags,
    content_summary: tpl.content_summary,
    fit_reason: `贴合${industry}行业特点，符合「${persona}」人设定位`,
    adapt_angle: '可借鉴其结构和节奏，替换为自家产品',
    video_url: `https://example.com/video/${Date.now()}-${idx}`,
    generated_date: today,
    created_at: new Date().toISOString(),
  }))

  if (!memory.daily_ideas) memory.daily_ideas = []
  memory.daily_ideas.push(...ideas)
  await saveToSupabase()
  return ideas
}

export async function listDailyIdeas(userId) {
  await ensureLoaded()
  const today = new Date().toISOString().slice(0, 10)
  return (memory.daily_ideas || [])
    .filter(i => i.user_id === userId && i.generated_date === today)
    .sort((a, b) => b.like_count - a.like_count)
}
