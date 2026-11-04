// 资源接口：合并素材中心(materials) + 对话记录(conversations) 的 CRUD
import { createCrudHandler } from '../server/crud.mjs'

const materialsHandler = createCrudHandler('materials')
const conversationsHandler = createCrudHandler('conversations')

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const type = url.searchParams.get('type') || 'materials'
  // 路由到对应集合的处理器
  if (type === 'conversations') {
    return conversationsHandler(req, res)
  }
  return materialsHandler(req, res)
}
