import { getStats } from "../server/db.mjs"

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  if (req.method === "OPTIONS") return res.status(204).end()
  try {
    const stats = await getStats()
    res.status(200).json(stats)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}
