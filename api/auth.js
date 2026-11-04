// 用户认证接口：register / login / me
import { normalizeEmail, findUserByEmail, createUser, getUserById, verifyPassword, signToken, verifyToken, sanitizeUser } from '../server/db.mjs'

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const url = new URL(req.url, `http://${req.headers.host}`)
  const action = url.searchParams.get('action') || url.pathname.split('/').pop()

  try {
    // /api/auth?action=register
    if (req.method === 'POST' && (action === 'register' || req.url.includes('register'))) {
      const { email: rawEmail, password: rawPassword, name } = req.body || {}
      const email = normalizeEmail(rawEmail)
      const password = String(rawPassword ?? '')
      if (!email || !password) {
        return res.status(400).json({ message: '邮箱和密码不能为空' })
      }
      if (password.length < 6) {
        return res.status(400).json({ message: '密码至少 6 位' })
      }
      const user = await createUser({ email, password, name })
      const token = signToken({ userId: user.id, email: user.email })
      return res.json({ token, user: sanitizeUser(user) })
    }

    // /api/auth?action=login
    if (req.method === 'POST' && (action === 'login' || req.url.includes('login'))) {
      const { email: rawEmail, password: rawPassword } = req.body || {}
      const email = normalizeEmail(rawEmail)
      const password = String(rawPassword ?? '')
      if (!email || !password) {
        return res.status(400).json({ message: '邮箱和密码不能为空' })
      }
      const user = await findUserByEmail(email)
      if (!user) {
        return res.status(401).json({ message: '该邮箱还没有注册，请先用这个邮箱注册' })
      }
      // 兼容注册时密码首尾带空格的输入习惯
      const ok = verifyPassword(password, user.password)
        || (password !== password.trim() && verifyPassword(password.trim(), user.password))
      if (!ok) {
        return res.status(401).json({ message: '密码错误，请重新输入' })
      }
      const token = signToken({ userId: user.id, email: user.email })
      return res.json({ token, user: sanitizeUser(user) })
    }

    // /api/auth?action=me  需带 Authorization: Bearer <token>
    if (action === 'me' || req.url.includes('me')) {
      const authHeader = req.headers.authorization || ''
      const token = authHeader.replace('Bearer ', '')
      const payload = verifyToken(token)
      if (!payload) {
        return res.status(401).json({ message: '未登录或登录已过期' })
      }
      // 优先按 email 读取单用户文件（避免 data.json 最终一致性延迟），兜底按 id
      let user = payload.email ? await findUserByEmail(payload.email) : null
      if (!user) user = await getUserById(payload.userId)
      if (!user) {
        return res.status(401).json({ message: '用户不存在' })
      }
      return res.json({ user: sanitizeUser(user) })
    }

    res.status(404).json({ message: '未知的认证操作' })
  } catch (err) {
    const status = err.statusCode || 500
    res.status(status).json({ message: err.message || '服务器错误' })
  }
}
