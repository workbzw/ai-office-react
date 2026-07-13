import type { Desk } from '@/types/agent'
import { DESKS, WAYPOINTS } from '@/scene/layout/officeLayout'
import {
  COL_AISLE_MARGIN,
  getRowCorridorY,
  SIDE_OFFSET,
} from '@/scene/navigation/deskNavGeometry'
import {
  createNavContext,
  polylineCrossesSeat,
  segmentCrossesSeat,
  shortestPath,
  type NavPathContext,
  type SeatCheckOptions,
} from '@/scene/navigation/navPathfinding'

export type { NavPathContext } from '@/scene/navigation/navPathfinding'
export { createNavContext }

export type NavPoint = { x: number; y: number }

type NavNode = NavPoint & { id: string }

export type DeskApproachSide = 'left' | 'right'

type DeskNavMeta = {
  leftAisleId: string
  rightAisleId: string
  /** 本列外侧过道（仅在此列做行间纵向移动） */
  corridorAisleId: string
  corridorY: number
  columnIndex: number
  columnCount: number
}

type NavGraph = {
  nodes: Map<string, NavNode>
  adj: Map<string, string[]>
  deskMeta: Map<string, DeskNavMeta>
}

const SEAT_DETECT = 12
const COL_CLUSTER_THRESH = 70
const ROW_CLUSTER_THRESH = 50
const PARTITION_X = 240
const HALL_GAP = 50

const AMENITIES = WAYPOINTS.filter((w) => w.kind !== 'desk')

let graph: NavGraph | null = null
let deskSignature = ''

function clusterCentroids(values: number[], threshold: number): number[] {
  if (values.length === 0) return []
  const sorted = [...values].sort((a, b) => a - b)
  const groups: number[][] = []
  for (const v of sorted) {
    const last = groups[groups.length - 1]
    if (!last || v - last[last.length - 1] > threshold) {
      groups.push([v])
    } else {
      last.push(v)
    }
  }
  return groups.map((g) => g.reduce((s, v) => s + v, 0) / g.length)
}

function linkEdge(adj: Map<string, string[]>, a: string, b: string) {
  if (!adj.has(a)) adj.set(a, [])
  if (!adj.has(b)) adj.set(b, [])
  if (!adj.get(a)!.includes(b)) adj.get(a)!.push(b)
  if (!adj.get(b)!.includes(a)) adj.get(b)!.push(a)
}

/** 根据工位阵列自动生成过道网格 */
export function buildNavGraph(desks: Desk[]): NavGraph {
  const nodes = new Map<string, NavNode>()
  const adj = new Map<string, string[]>()
  const deskMeta = new Map<string, DeskNavMeta>()

  const colCentroids = clusterCentroids(
    desks.map((d) => d.x),
    COL_CLUSTER_THRESH,
  )
  const rowSeatYs = clusterCentroids(
    desks.map((d) => d.seatY),
    ROW_CLUSTER_THRESH,
  )
  const rowCorridorYs: number[] = []
  for (let ri = 0; ri < rowSeatYs.length; ri++) {
    const sample = desks.find(
      (d) => Math.abs(d.seatY - rowSeatYs[ri]) < ROW_CLUSTER_THRESH,
    )
    rowCorridorYs.push(
      sample ? getRowCorridorY(sample) : rowSeatYs[ri] - 40,
    )
  }

  const nCols = colCentroids.length
  const nRows = rowSeatYs.length

  const colAisleX: number[] = []
  if (nCols > 0) {
    colAisleX.push(colCentroids[0] - COL_AISLE_MARGIN)
    for (let i = 0; i < nCols - 1; i++) {
      colAisleX.push((colCentroids[i] + colCentroids[i + 1]) / 2)
    }
    colAisleX.push(colCentroids[nCols - 1] + COL_AISLE_MARGIN)
  }

  const addNode = (id: string, x: number, y: number) => {
    nodes.set(id, { id, x, y })
  }

  for (let ci = 0; ci < colAisleX.length; ci++) {
    for (let ri = 0; ri < nRows; ri++) {
      const corridorY = rowCorridorYs[ri] ?? rowSeatYs[ri]
      addNode(`aisle-c${ci}-r${ri}`, colAisleX[ci], corridorY)
    }
  }

  const lastAisleCol = colAisleX.length - 1
  for (let ci = 0; ci < colAisleX.length; ci++) {
    for (let ri = 0; ri < nRows; ri++) {
      const id = `aisle-c${ci}-r${ri}`
      if (ci > 0) linkEdge(adj, id, `aisle-c${ci - 1}-r${ri}`)
      // 中间列过道在桌列之间，只做横向连通，不做行间纵向（避免穿桌）
      if (ri > 0 && (ci === 0 || ci === lastAisleCol)) {
        linkEdge(adj, id, `aisle-c${ci}-r${ri - 1}`)
      }
    }
  }

  const hallY =
    rowCorridorYs.length > 0
      ? rowCorridorYs.reduce((s, y) => s + y, 0) / rowCorridorYs.length
      : rowSeatYs.length > 0
        ? rowSeatYs.reduce((s, y) => s + y, 0) / rowSeatYs.length
        : 270
  const hallX = PARTITION_X + HALL_GAP
  addNode('hall', hallX, hallY)

  if (colAisleX.length > 0) {
    for (let ri = 0; ri < nRows; ri++) {
      linkEdge(adj, 'hall', `aisle-c0-r${ri}`)
    }
  }

  for (const wp of AMENITIES) {
    addNode(wp.id, wp.x, wp.y)
    linkEdge(adj, 'hall', wp.id)
  }

  const nearestCol = (x: number) => {
    let best = 0
    let bestD = Infinity
    for (let i = 0; i < colCentroids.length; i++) {
      const d = Math.abs(colCentroids[i] - x)
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    return best
  }

  const nearestRow = (seatY: number) => {
    let best = 0
    let bestD = Infinity
    for (let i = 0; i < rowSeatYs.length; i++) {
      const d = Math.abs(rowSeatYs[i] - seatY)
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    return best
  }

  for (const desk of desks) {
    const col = nearestCol(desk.x)
    const row = nearestRow(desk.seatY)
    const leftAisleId = `aisle-c${col}-r${row}`
    const rightAisleId = `aisle-c${col + 1}-r${row}`
    const corridorAisleId =
      col === 0
        ? leftAisleId
        : col === nCols - 1
          ? rightAisleId
          : leftAisleId
    deskMeta.set(desk.id, {
      leftAisleId,
      rightAisleId,
      corridorAisleId,
      corridorY: rowCorridorYs[row] ?? getRowCorridorY(desk),
      columnIndex: col,
      columnCount: nCols,
    })
  }

  return { nodes, adj, deskMeta }
}

function ensureGraph(): NavGraph {
  const sig = DESKS.map((d) => `${d.x},${d.y},${d.seatX},${d.seatY}`).join('|')
  if (!graph || sig !== deskSignature) {
    deskSignature = sig
    graph = buildNavGraph(DESKS)
  }
  return graph
}

/** 工位布局变更后调用（改 DESKS / buildDesks 后自动也会在下次寻路时重建） */
export function rebuildOfficeNavigation(desks: Desk[] = DESKS) {
  deskSignature = desks.map((d) => `${d.x},${d.y},${d.seatX},${d.seatY}`).join('|')
  graph = buildNavGraph(desks)
}

export function findDeskAtSeat(x: number, y: number): Desk | undefined {
  return DESKS.find(
    (d) => Math.hypot(d.seatX - x, d.seatY - y) < SEAT_DETECT,
  )
}

const SEAT_SIDE_DEADZONE = 10

/** 根据参考点相对工位的水平位置选左侧或右侧入席/离席 */
export function pickDeskApproachSide(
  desk: Desk,
  referenceX: number,
): DeskApproachSide {
  const dx = referenceX - desk.seatX
  if (dx < -SEAT_SIDE_DEADZONE) return 'left'
  if (dx > SEAT_SIDE_DEADZONE) return 'right'

  const meta = ensureGraph().deskMeta.get(desk.id)
  if (!meta) return 'left'

  const g = ensureGraph()
  const left = g.nodes.get(meta.leftAisleId)!
  const right = g.nodes.get(meta.rightAisleId)!
  const dL = Math.abs(referenceX - left.x)
  const dR = Math.abs(referenceX - right.x)
  return dL <= dR ? 'left' : 'right'
}

const SAME_ROW_SEAT_Y_THRESH = 14

function deskIdsForLateralMoveCheck(
  desk: Desk,
  x: number,
  y: number,
): string[] {
  const ids = [desk.id]
  if (Math.abs(y - desk.seatY) > SAME_ROW_SEAT_Y_THRESH) return ids
  for (const d of DESKS) {
    if (d.id === desk.id) continue
    if (Math.abs(y - d.seatY) > SAME_ROW_SEAT_Y_THRESH) continue
    for (const s of ['left', 'right'] as const) {
      const sp = getSideApproachPoint(d, s)
      if (Math.hypot(x - sp.x, y - sp.y) < 22) {
        ids.push(d.id)
        return ids
      }
    }
  }
  return ids
}

function canLateralExitAlongSeatRow(
  desk: Desk,
  side: DeskApproachSide,
  toX: number,
  toY: number,
): boolean {
  if (Math.abs(toY - desk.seatY) > SAME_ROW_SEAT_Y_THRESH) return false
  const sidePt = getSideApproachPoint(desk, side)
  if (side === 'left') return toX <= sidePt.x + 4
  return toX >= sidePt.x - 4
}

function lateralSeatCheck(
  desk: Desk,
  x: number,
  y: number,
): SeatCheckOptions {
  return { excludeDeskIds: deskIdsForLateralMoveCheck(desk, x, y) }
}

function tryLateralExitPath(
  desk: Desk,
  side: DeskApproachSide,
  toX: number,
  toY: number,
  ctx?: NavPathContext,
): NavPoint[] | null {
  if (!canLateralExitAlongSeatRow(desk, side, toX, toY)) return null
  const sidePt = getSideApproachPoint(desk, side)
  const steps: NavPoint[] = [
    { x: desk.seatX, y: desk.seatY },
    sidePt,
    { x: toX, y: toY },
  ]
  if (polylineCrossesSeat(steps, ctx, lateralSeatCheck(desk, toX, toY))) {
    return null
  }
  return steps
}

function lateralExitCost(
  desk: Desk,
  side: DeskApproachSide,
  toX: number,
  toY: number,
  ctx?: NavPathContext,
): number | null {
  const steps = tryLateralExitPath(desk, side, toX, toY, ctx)
  if (!steps) return null
  let cost = 0
  for (let i = 1; i < steps.length; i++) {
    const a = steps[i - 1]!
    const b = steps[i]!
    cost += Math.hypot(b.x - a.x, b.y - a.y)
  }
  return cost
}

function canLateralEnterAlongSeatRow(
  desk: Desk,
  side: DeskApproachSide,
  fromX: number,
  fromY: number,
): boolean {
  if (Math.abs(fromY - desk.seatY) > SAME_ROW_SEAT_Y_THRESH) return false
  const sidePt = getSideApproachPoint(desk, side)
  if (side === 'left') return fromX <= sidePt.x + 4
  return fromX >= sidePt.x - 4
}

function tryLateralEnterPath(
  desk: Desk,
  side: DeskApproachSide,
  fromX: number,
  fromY: number,
  ctx?: NavPathContext,
): NavPoint[] | null {
  if (!canLateralEnterAlongSeatRow(desk, side, fromX, fromY)) return null
  const sidePt = getSideApproachPoint(desk, side)
  const steps: NavPoint[] = [
    { x: fromX, y: fromY },
    sidePt,
    { x: desk.seatX, y: desk.seatY },
  ]
  if (polylineCrossesSeat(steps, ctx, lateralSeatCheck(desk, fromX, fromY))) {
    return null
  }
  return steps
}

function lateralEnterCost(
  desk: Desk,
  side: DeskApproachSide,
  fromX: number,
  fromY: number,
  ctx?: NavPathContext,
): number | null {
  const steps = tryLateralEnterPath(desk, side, fromX, fromY, ctx)
  if (!steps) return null
  let cost = 0
  for (let i = 1; i < steps.length; i++) {
    const a = steps[i - 1]!
    const b = steps[i]!
    cost += Math.hypot(b.x - a.x, b.y - a.y)
  }
  return cost
}

function estimateExitCost(
  desk: Desk,
  side: DeskApproachSide,
  toX: number,
  toY: number,
  ctx?: NavPathContext,
): number {
  const direct = lateralExitCost(desk, side, toX, toY, ctx)
  if (direct != null) return direct

  const meta = ensureGraph().deskMeta.get(desk.id)
  if (!meta) {
    const pt = getSideApproachPoint(desk, side)
    return Math.hypot(pt.x - toX, pt.y - toY)
  }

  const g = ensureGraph()
  const aisleId = side === 'left' ? meta.leftAisleId : meta.rightAisleId
  const aisle = g.nodes.get(aisleId)!
  const sidePt = getSideApproachPoint(desk, side)
  const slideY = desk.seatY
  const seatCheck = lateralSeatCheck(desk, toX, toY)

  let cost = Math.hypot(sidePt.x - desk.seatX, sidePt.y - desk.seatY)
  if (!segmentCrossesSeat(sidePt.x, sidePt.y, aisle.x, slideY, ctx, seatCheck)) {
    cost += Math.hypot(sidePt.x - aisle.x, sidePt.y - slideY)
  } else {
    cost += 800
  }

  const toId = nearestNodeId(g, toX, toY)
  const ids = shortestPath(g.nodes, g.adj, aisleId, toId, ctx)
  if (!ids) {
    cost += Math.hypot(aisle.x - toX, aisle.y - toY)
    return cost
  }

  cost += pathIdsLength(g, ids)
  const last = g.nodes.get(ids[ids.length - 1]!)!
  cost += Math.hypot(toX - last.x, toY - last.y)
  return cost
}

function estimateEnterCost(
  desk: Desk,
  side: DeskApproachSide,
  fromX: number,
  fromY: number,
  ctx?: NavPathContext,
): number {
  const direct = lateralEnterCost(desk, side, fromX, fromY, ctx)
  if (direct != null) return direct

  const meta = ensureGraph().deskMeta.get(desk.id)
  if (!meta) {
    const pt = getSideApproachPoint(desk, side)
    return Math.hypot(pt.x - fromX, pt.y - fromY)
  }

  const g = ensureGraph()
  const approachAisleId = side === 'left' ? meta.leftAisleId : meta.rightAisleId
  const approachAisle = g.nodes.get(approachAisleId)!
  const sidePt = getSideApproachPoint(desk, side)

  const fromId = nearestNodeId(g, fromX, fromY)
  const ids = shortestPath(g.nodes, g.adj, fromId, approachAisleId, ctx)
  let cost = 0
  if (!ids) {
    cost += Math.hypot(fromX - approachAisle.x, fromY - approachAisle.y)
  } else {
    cost += pathIdsLength(g, ids)
    const last = g.nodes.get(ids[ids.length - 1]!)!
    cost += Math.hypot(last.x - approachAisle.x, last.y - approachAisle.y)
  }

  const seg = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
  ): number => {
    if (segmentCrossesSeat(ax, ay, bx, by, ctx)) return 800
    return Math.hypot(bx - ax, by - ay)
  }

  cost += seg(approachAisle.x, desk.seatY, sidePt.x, sidePt.y)

  cost += Math.hypot(desk.seatX - sidePt.x, desk.seatY - sidePt.y)
  return cost
}

/** 离座选距目的地更近的一侧（左/右均可） */
export function pickDeskExitSide(
  desk: Desk,
  toX: number,
  toY: number,
  ctx?: NavPathContext,
): DeskApproachSide {
  const leftCost = estimateExitCost(desk, 'left', toX, toY, ctx)
  const rightCost = estimateExitCost(desk, 'right', toX, toY, ctx)
  return leftCost <= rightCost ? 'left' : 'right'
}

/** 回座选距当前位置更近的一侧（左/右均可） */
export function pickDeskEnterSide(
  desk: Desk,
  fromX: number,
  fromY: number,
  ctx?: NavPathContext,
): DeskApproachSide {
  const leftCost = estimateEnterCost(desk, 'left', fromX, fromY, ctx)
  const rightCost = estimateEnterCost(desk, 'right', fromX, fromY, ctx)
  return leftCost <= rightCost ? 'left' : 'right'
}

export function getSideApproachPoint(
  desk: Desk,
  side: DeskApproachSide,
): NavPoint {
  return {
    x: side === 'left' ? desk.seatX - SIDE_OFFSET : desk.seatX + SIDE_OFFSET,
    y: desk.seatY,
  }
}

/** 访客站在目标工位侧面（优先选离当前位置更近的一侧） */
export function getDeskVisitStandPoint(
  visitorDesk: Desk,
  hostDesk: Desk,
  fromX?: number,
  fromY?: number,
): NavPoint {
  const left = getSideApproachPoint(hostDesk, 'left')
  const right = getSideApproachPoint(hostDesk, 'right')
  if (fromX != null && fromY != null) {
    const dL = Math.hypot(left.x - fromX, left.y - fromY)
    const dR = Math.hypot(right.x - fromX, right.y - fromY)
    return dL <= dR ? left : right
  }
  return visitorDesk.x <= hostDesk.x ? left : right
}

export function planWalkToDeskVisit(
  fromX: number,
  fromY: number,
  hostDesk: Desk,
  visitorDesk: Desk,
  ctx?: NavPathContext,
): NavPoint[] {
  const stand = getDeskVisitStandPoint(visitorDesk, hostDesk, fromX, fromY)
  if (findDeskAtSeat(fromX, fromY)) {
    return planWalkFrom(fromX, fromY, stand.x, stand.y, ctx)
  }
  return planWalkTo(fromX, fromY, stand.x, stand.y, ctx)
}

function nearestNodeId(g: NavGraph, x: number, y: number): string {
  let best = [...g.nodes.keys()][0]
  let bestD = Infinity
  for (const n of g.nodes.values()) {
    const d = (n.x - x) ** 2 + (n.y - y) ** 2
    if (d < bestD) {
      bestD = d
      best = n.id
    }
  }
  return best
}

function idsToPoints(g: NavGraph, ids: string[]): NavPoint[] {
  return ids.map((id) => {
    const n = g.nodes.get(id)!
    return { x: n.x, y: n.y }
  })
}

function pathIdsLength(g: NavGraph, ids: string[]): number {
  let len = 0
  for (let i = 1; i < ids.length; i++) {
    const a = g.nodes.get(ids[i - 1]!)!
    const b = g.nodes.get(ids[i]!)!
    len += Math.hypot(b.x - a.x, b.y - a.y)
  }
  return len
}

function dedupePoints(points: NavPoint[]): NavPoint[] {
  const out: NavPoint[] = []
  for (const p of points) {
    const prev = out[out.length - 1]
    if (prev && Math.hypot(prev.x - p.x, prev.y - p.y) < 3) continue
    out.push(p)
  }
  return out
}

export function planWalkTo(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  ctx?: NavPathContext,
): NavPoint[] {
  const g = ensureGraph()
  const fromId = nearestNodeId(g, fromX, fromY)
  const toId = nearestNodeId(g, toX, toY)
  const ids = shortestPath(g.nodes, g.adj, fromId, toId, ctx)
  if (!ids) return [{ x: toX, y: toY }]

  const points = idsToPoints(g, ids)
  const last = points[points.length - 1]
  if (Math.hypot(last.x - toX, last.y - toY) > 4) {
    points.push({ x: toX, y: toY })
  }
  return points
}

export function planWalkFrom(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  ctx?: NavPathContext,
): NavPoint[] {
  const desk = findDeskAtSeat(fromX, fromY)
  if (desk) {
    const g = ensureGraph()
    const meta = g.deskMeta.get(desk.id)
    if (!meta) {
      return dedupePoints([
        { x: desk.seatX, y: desk.seatY },
        { x: toX, y: toY },
      ])
    }
    const exitSide = pickDeskExitSide(desk, toX, toY, ctx)
    const lateral = tryLateralExitPath(desk, exitSide, toX, toY, ctx)
    if (lateral) return dedupePoints(lateral)

    const side = getSideApproachPoint(desk, exitSide)
    const exitAisleId =
      exitSide === 'left' ? meta.leftAisleId : meta.rightAisleId
    const exitAisle = g.nodes.get(exitAisleId)!
    const steps: NavPoint[] = [
      { x: desk.seatX, y: desk.seatY },
      side,
    ]
    const aislePt = { x: exitAisle.x, y: desk.seatY }
    const seatCheck = lateralSeatCheck(desk, toX, toY)
    if (
      Math.abs(exitAisle.x - side.x) > 4 &&
      !segmentCrossesSeat(
        side.x,
        side.y,
        aislePt.x,
        aislePt.y,
        ctx,
        seatCheck,
      )
    ) {
      steps.push(aislePt)
    }
    const tail = steps[steps.length - 1]!
    const corridor = planWalkTo(tail.x, tail.y, toX, toY, ctx)
    return dedupePoints([...steps, ...corridor])
  }
  return planWalkTo(fromX, fromY, toX, toY, ctx)
}

export function planWalkToDeskSeat(
  fromX: number,
  fromY: number,
  desk: Desk,
  ctx?: NavPathContext,
): NavPoint[] {
  if (findDeskAtSeat(fromX, fromY)?.id === desk.id) {
    return [{ x: desk.seatX, y: desk.seatY }]
  }

  const g = ensureGraph()
  const meta = g.deskMeta.get(desk.id)
  if (!meta) {
    return [{ x: desk.seatX, y: desk.seatY }]
  }

  const approachSide = pickDeskEnterSide(desk, fromX, fromY, ctx)
  const lateral = tryLateralEnterPath(desk, approachSide, fromX, fromY, ctx)
  if (lateral) return dedupePoints(lateral)

  const side = getSideApproachPoint(desk, approachSide)
  const approachAisleId =
    approachSide === 'left' ? meta.leftAisleId : meta.rightAisleId
  const approachAisle = g.nodes.get(approachAisleId)!

  const fromId = nearestNodeId(g, fromX, fromY)
  const ids = shortestPath(g.nodes, g.adj, fromId, approachAisleId, ctx)
  const points = ids ? idsToPoints(g, ids) : []

  const approachPt = { x: approachAisle.x, y: desk.seatY }
  const last = points[points.length - 1]
  if (
    !last ||
    Math.hypot(last.x - approachPt.x, last.y - approachPt.y) > 4
  ) {
    if (
      !segmentCrossesSeat(
        last?.x ?? fromX,
        last?.y ?? fromY,
        approachPt.x,
        approachPt.y,
        ctx,
        lateralSeatCheck(desk, fromX, fromY),
      )
    ) {
      points.push(approachPt)
    }
  }
  const beforeSide = points[points.length - 1]
  if (
    (!beforeSide ||
      Math.hypot(beforeSide.x - side.x, beforeSide.y - side.y) > 4) &&
    !segmentCrossesSeat(
      beforeSide?.x ?? fromX,
      beforeSide?.y ?? fromY,
      side.x,
      side.y,
      ctx,
      lateralSeatCheck(desk, fromX, fromY),
    )
  ) {
    points.push(side)
  }
  points.push({ x: desk.seatX, y: desk.seatY })

  return dedupePoints(points)
}

export function pickCorridorDestination(): NavPoint {
  const g = ensureGraph()
  const amenity = AMENITIES[Math.floor(Math.random() * AMENITIES.length)]
  if (Math.random() < 0.55 && amenity) {
    const n = g.nodes.get(amenity.id)!
    return { x: n.x, y: n.y }
  }
  const keys = [...g.nodes.keys()].filter((k) => k.startsWith('aisle-'))
  const id = keys[Math.floor(Math.random() * keys.length)] ?? 'hall'
  const n = g.nodes.get(id)!
  return { x: n.x, y: n.y }
}
