// 员工动作接口：替代 localhost:8765/actions
// GET 获取待执行动作，POST 提交新动作
import { list, create, remove } from "../server/db.mjs"

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  if (req.method === "OPTIONS") return res.status(204).end()

  try {
    if (req.method === "GET") {
      // 返回所有待执行动作（前端执行后会 DELETE）
      const actions = await list("actions")
      // 按创建时间正序（先入先出）
      actions.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      // 只返回动作本身，不返回 id 等元数据
      const cleaned = actions.map(a => ({
        type: a.type,
        visitor: a.visitor,
        host: a.host,
        hosts: a.hosts,
        agentId: a.agentId,
        state: a.state,
        task: a.task,
        message: a.message,
        _id: a.id,
      }))
      return res.status(200).json(cleaned)
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body
      const action = await create("actions", body)
      return res.status(201).json(action)
    }

    if (req.method === "DELETE") {
      const url = new URL(req.url || '', `http://${req.headers.host}`)
      const id = url.searchParams.get('id')
      if (!id) return res.status(400).json({ message: "缺少 id" })
      await remove("actions", Number(id))
      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ message: "方法不支持" })
  } catch (error) {
    console.error('[actions] error:', error)
    return res.status(500).json({ message: error.message })
  }
}
