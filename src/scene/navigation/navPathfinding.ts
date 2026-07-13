import type { Agent } from '@/types/agent'
import { DESKS } from '@/scene/layout/officeLayout'

/** 座椅禁区半径：路径线段距座椅点小于此值则视为穿座 */
const SEAT_BLOCK_RADIUS = 34

const SEAT_DETECT = 12

export type NavPathContext = {
  agents?: Agent[]
  selfAgentId?: string
}

export type SeatCheckOptions = {
  /** 不计入禁区（本工位离座/邻座拜访等） */
  excludeDeskIds?: string[]
}

type NavNodeLike = { id: string; x: number; y: number }

type Adjacency = Map<string, string[]>

export function createNavContext(
  agents: Agent[],
  selfAgentId?: string,
): NavPathContext {
  return { agents, selfAgentId }
}

function distPointToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-6) return Math.hypot(px - ax, py - ay)
  let t = ((px - ax) * dx + (py - ay) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const qx = ax + t * dx
  const qy = ay + t * dy
  return Math.hypot(px - qx, py - qy)
}

function collectSeatObstacles(
  ctx?: NavPathContext,
  options?: SeatCheckOptions,
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  const exclude = new Set(options?.excludeDeskIds ?? [])

  for (const desk of DESKS) {
    if (exclude.has(desk.id)) continue
    out.push({ x: desk.seatX, y: desk.seatY })
  }

  const agents = ctx?.agents ?? []
  for (const agent of agents) {
    if (agent.id === ctx?.selfAgentId) continue
    const desk = DESKS.find((d) => d.id === agent.assignedDeskId)
    if (!desk || exclude.has(desk.id)) continue
    if (
      agent.state === 'working' ||
      agent.state === 'talking' ||
      agent.state === 'thinking'
    ) {
      if (Math.hypot(agent.x - desk.seatX, agent.y - desk.seatY) < SEAT_DETECT + 6) {
        out.push({ x: agent.x, y: agent.y })
      }
    }
  }

  return out
}

/** 线段是否穿过任一座椅禁区 */
export function segmentCrossesSeat(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  ctx?: NavPathContext,
  options?: SeatCheckOptions,
): boolean {
  const obstacles = collectSeatObstacles(ctx, options)
  for (const seat of obstacles) {
    if (distPointToSegment(seat.x, seat.y, ax, ay, bx, by) < SEAT_BLOCK_RADIUS) {
      return true
    }
  }
  return false
}

function edgeWeight(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay)
}

/**
 * Dijkstra 最短路径（按欧氏距离），跳过穿过座椅的边。
 */
export function shortestPath(
  nodes: Map<string, NavNodeLike>,
  adj: Adjacency,
  fromId: string,
  toId: string,
  ctx?: NavPathContext,
): string[] | null {
  if (fromId === toId) return [fromId]

  const dist = new Map<string, number>()
  const prev = new Map<string, string | null>()
  const visited = new Set<string>()

  for (const id of nodes.keys()) dist.set(id, Infinity)
  dist.set(fromId, 0)

  while (visited.size < nodes.size) {
    let u: string | null = null
    let best = Infinity
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < best) {
        best = d
        u = id
      }
    }
    if (u == null || best === Infinity) break
    if (u === toId) break
    visited.add(u)

    const nu = nodes.get(u)!
    for (const vId of adj.get(u) ?? []) {
      if (visited.has(vId)) continue
      const nv = nodes.get(vId)!
      if (segmentCrossesSeat(nu.x, nu.y, nv.x, nv.y, ctx)) continue

      const alt = best + edgeWeight(nu.x, nu.y, nv.x, nv.y)
      if (alt < (dist.get(vId) ?? Infinity)) {
        dist.set(vId, alt)
        prev.set(vId, u)
      }
    }
  }

  if ((dist.get(toId) ?? Infinity) === Infinity) return null

  const ids: string[] = []
  let p: string | null = toId
  while (p) {
    ids.unshift(p)
    p = prev.get(p) ?? null
  }
  return ids.length > 0 ? ids : null
}

/** 折线行走是否穿座（用于离座/入席的短段校验） */
export function polylineCrossesSeat(
  points: { x: number; y: number }[],
  ctx?: NavPathContext,
  options?: SeatCheckOptions,
): boolean {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    if (segmentCrossesSeat(a.x, a.y, b.x, b.y, ctx, options)) return true
  }
  return false
}
