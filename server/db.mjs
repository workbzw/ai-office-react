// 数据存储层：内存缓存 + Supabase Storage 持久化（降级时仅内存）
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET_NAME = 'app-data'
const DATA_FILE = 'data.json'

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
}

// 自增 ID
const idCounters = {
  topics: 1, scripts: 1, tasks: 1, activities: 1,
  materials: 1, conversations: 1, notifications: 1, actions: 1,
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
    console.log('[DB] Loaded data from Supabase Storage')
  } catch (e) {
    console.log('[DB] Load from Supabase failed:', e.message)
  }
}

// 保存到 Supabase Storage
async function saveToSupabase() {
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

// 每次从 Supabase 加载最新数据（Serverless 无状态，需跨调用同步）
async function ensureLoaded() {
  // 重置内存数据，从 Supabase 重新加载
  for (const key of Object.keys(memory)) memory[key] = []
  for (const key of Object.keys(idCounters)) idCounters[key] = 1
  await loadFromSupabase()
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
  await ensureLoaded()
  const item = {
    id: genId(collection),
    ...data,
    created_at: new Date().toISOString(),
  }
  if (!memory[collection]) memory[collection] = []
  memory[collection].push(item)
  await saveToSupabase()
  return item
}

export async function update(collection, id, data) {
  await ensureLoaded()
  const arr = memory[collection] || []
  const idx = arr.findIndex(item => item.id === id)
  if (idx === -1) return null
  arr[idx] = { ...arr[idx], ...data, updated_at: new Date().toISOString() }
  await saveToSupabase()
  return arr[idx]
}

export async function remove(collection, id) {
  await ensureLoaded()
  const arr = memory[collection] || []
  const idx = arr.findIndex(item => item.id === id)
  if (idx === -1) return false
  arr.splice(idx, 1)
  await saveToSupabase()
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
