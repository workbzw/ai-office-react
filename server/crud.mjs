// 通用 CRUD 处理工具
import { list, get, create, update, remove } from './db.mjs'

export function createCrudHandler(collection) {
  return async function handler(req, res) {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")

    if (req.method === "OPTIONS") {
      return res.status(204).end()
    }

    try {
      const url = new URL(req.url || '', `http://${req.headers.host}`)
      const id = url.searchParams.get('id')

      if (req.method === "GET") {
        if (id) {
          const item = await get(collection, Number(id))
          if (!item) return res.status(404).json({ message: "未找到" })
          return res.status(200).json(item)
        }
        const items = await list(collection)
        // 按创建时间倒序
        items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        return res.status(200).json(items)
      }

      if (req.method === "POST") {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body
        const item = await create(collection, body)
        return res.status(201).json(item)
      }

      if (req.method === "PUT") {
        if (!id) return res.status(400).json({ message: "缺少 id" })
        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body
        const item = await update(collection, Number(id), body)
        if (!item) return res.status(404).json({ message: "未找到" })
        return res.status(200).json(item)
      }

      if (req.method === "DELETE") {
        if (!id) return res.status(400).json({ message: "缺少 id" })
        const ok = await remove(collection, Number(id))
        if (!ok) return res.status(404).json({ message: "未找到" })
        return res.status(200).json({ success: true })
      }

      return res.status(405).json({ message: "方法不支持" })
    } catch (error) {
      console.error(`[${collection}] error:`, error)
      return res.status(500).json({ message: error.message || "服务器错误" })
    }
  }
}
