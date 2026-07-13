import type { Desk } from '@/types/agent'
import { SEAT_OFFSET_Y } from '@/scene/layout/officeLayout'

/** 与 DeskEntity 一致 */
export const DESK_DISPLAY_WIDTH = (152 * 2) / 3
export const DESK_SPRITE_OFFSET_Y = SEAT_OFFSET_Y - 14
export const DESK_SPRITE_ANCHOR_Y = 0.62
/** desk.png 约 3:2，与缩放后包围盒对齐 */
export const DESK_DISPLAY_HEIGHT = DESK_DISPLAY_WIDTH * 0.72

export const NAV_AGENT_CLEARANCE = 16

/** 侧面入席点须落在桌面水平范围外 */
export const SIDE_OFFSET =
  Math.ceil(DESK_DISPLAY_WIDTH / 2) + NAV_AGENT_CLEARANCE

/** 列过道在桌面外侧 */
export const COL_AISLE_MARGIN = SIDE_OFFSET + 6

export function getDeskBounds(desk: Desk) {
  const anchorY = desk.y + DESK_SPRITE_OFFSET_Y
  const halfW = DESK_DISPLAY_WIDTH / 2
  const h = DESK_DISPLAY_HEIGHT
  return {
    top: anchorY - h * DESK_SPRITE_ANCHOR_Y,
    bottom: anchorY + h * (1 - DESK_SPRITE_ANCHOR_Y),
    left: desk.x - halfW,
    right: desk.x + halfW,
  }
}

/** 行向过道与座椅同高：离座/回座/寻路均不先上抬再过道 */
export function getRowCorridorY(desk: Desk): number {
  return desk.seatY
}

export function isFrontRowDesk(
  desk: Desk,
  corridorY: number,
): boolean {
  return Math.abs(corridorY - desk.seatY) < 8
}
