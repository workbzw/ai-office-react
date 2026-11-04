// 工作台接口：行业映射列表/选择 + 每日选题灵感生成/查看
import {
  listIndustryMappings, get, updateUserIndustry,
  generateDailyIdeas, listDailyIdeas,
  verifyToken, sanitizeUser,
} from '../server/db.mjs'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const action = url.searchParams.get('action')

    // ===== 行业映射 =====
    // GET /api/workbench?action=industries — 返回所有行业选项
    if (req.method === 'GET' && action === 'industries') {
      const mappings = await listIndustryMappings()
      return res.json(mappings)
    }

    // POST /api/workbench?action=select-industry — 用户选择行业（支持预设或自定义）
    if (req.method === 'POST' && action === 'select-industry') {
      const authHeader = req.headers.authorization || ''
      const payload = verifyToken(authHeader.replace('Bearer ', ''))
      if (!payload) return res.status(401).json({ message: '请先登录' })

      const body = req.body || {}
      let industry

      if (body.industryId === 'custom') {
        // 自定义行业
        if (!body.industry || !body.industry.trim()) {
          return res.status(400).json({ message: '请填写你的行业' })
        }
        industry = {
          id: 0,
          industry: body.industry.trim(),
          persona: body.persona?.trim() || '行业从业者，会分享专业经验和日常',
          content_type: body.content_type?.trim() || '经验分享 + 日常记录',
          target_audience: body.target_audience?.trim() || '对该行业感兴趣的人群',
        }
      } else {
        if (!body.industryId) return res.status(400).json({ message: '请选择行业' })
        industry = await get('industry_mappings', Number(body.industryId))
        if (!industry) return res.status(404).json({ message: '行业不存在' })
      }

      const updated = await updateUserIndustry(payload.userId, payload.email, industry)
      if (!updated) return res.status(404).json({ message: '用户不存在，请重新登录' })
      return res.json({ user: sanitizeUser(updated) })
    }

    // ===== 每日选题灵感 =====
    // 以下接口均需登录
    const authHeader = req.headers.authorization || ''
    const payload = verifyToken(authHeader.replace('Bearer ', ''))
    if (!payload) return res.status(401).json({ message: '请先登录' })

    // GET /api/workbench?action=daily-ideas — 查看今日选题灵感
    if (req.method === 'GET' && action === 'daily-ideas') {
      const ideas = await listDailyIdeas(payload.userId)
      return res.json({ ideas })
    }

    // POST /api/workbench?action=daily-ideas — 生成今日选题灵感
    if (req.method === 'POST' && action === 'daily-ideas') {
      const ideas = await generateDailyIdeas(payload.userId)
      return res.json({ ideas })
    }

    res.status(404).json({ message: '未知操作' })
  } catch (err) {
    const status = err.statusCode || 500
    res.status(status).json({ message: err.message || '服务器错误' })
  }
}
