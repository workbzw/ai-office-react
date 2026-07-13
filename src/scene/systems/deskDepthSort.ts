import type { Desk } from '@/types/agent'
import { SEAT_OFFSET_Y } from '@/scene/layout/officeLayout'

/** 与 DeskEntity 桌沿锚点对齐：此线以上（y 更小）人在桌后 */
export const DESK_DEPTH_SPLIT_OFFSET = SEAT_OFFSET_Y - 14

/** 椅背前沿：此线以上椅子挡人，以下人挡椅子（坐着时 y ≈ seatY 在上方） */
export const CHAIR_DEPTH_SPLIT_OFFSET = SEAT_OFFSET_Y + 4

const NEAR_X = 78
const NEAR_Y = 130

export function getDeskDepthSplitY(desk: Desk): number {
  return desk.y + DESK_DEPTH_SPLIT_OFFSET
}

export function getChairDepthSplitY(desk: Desk): number {
  return desk.y + CHAIR_DEPTH_SPLIT_OFFSET
}

export function isAgentNearDesk(
  desk: Desk,
  ax: number,
  ay: number,
): boolean {
  return (
    Math.abs(ax - desk.x) < NEAR_X && Math.abs(ay - desk.y) < NEAR_Y
  )
}

type AgentPos = { x: number; y: number }

function applySplitDepthZ(
  baseZ: number,
  split: number,
  agents: AgentPos[],
  desk: Desk,
  agentAhead: number,
  agentBehind: number,
): number {
  let z = baseZ

  for (const a of agents) {
    if (!isAgentNearDesk(desk, a.x, a.y)) continue
    if (a.y < split) {
      z = Math.max(z, a.y + agentBehind)
    } else {
      z = Math.min(z, a.y - agentAhead)
    }
  }

  return z
}

/**
 * 桌沿为界：人在上方 → 桌子 z 更大挡住人；人在下方 → 桌子 z 更小被人挡住
 */
export function computeDeskLayerZ(desk: Desk, agents: AgentPos[]): number {
  return applySplitDepthZ(
    desk.y,
    getDeskDepthSplitY(desk),
    agents,
    desk,
    0.5,
    0.5,
  )
}

/**
 * 椅背为界：与桌子相同的 Y 轴规则，分界在座位略前方
 */
export function computeChairLayerZ(
  desk: Desk,
  agents: AgentPos[],
  chairAhead = 2,
): number {
  return applySplitDepthZ(
    desk.seatY + chairAhead,
    getChairDepthSplitY(desk),
    agents,
    desk,
    0.5,
    1.5,
  )
}
