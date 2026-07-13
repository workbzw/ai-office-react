import type { ChibiFacing } from '@/scene/characters/chibiAgentPresets'

/**
 * 根据「朝目标移动」的位移判断四向（Pixi：x 右为正，y 下为正）
 * - 横向分量 ≥ 纵向 → 左跑 / 右跑
 * - 否则 → 上跑背面 / 下跑正面
 */
export function resolveWalkViewFacing(dx: number, dy: number): ChibiFacing {
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)
  if (absDx < 0.5 && absDy < 0.5) return 'front'

  if (absDx >= absDy) {
    return dx < 0 ? 'left' : 'right'
  }
  return dy < 0 ? 'back' : 'front'
}

export function viewFacingToLR(facing: ChibiFacing): 1 | -1 {
  return facing === 'left' ? -1 : 1
}

const TALK_FACE_DX = 6

/** 对话时朝向对方：目标在左则面向左，在右则面向右 */
export function resolveTalkViewFacing(
  fromX: number,
  fromY: number,
  targetX: number,
  targetY: number,
): ChibiFacing {
  const dx = targetX - fromX
  if (dx < -TALK_FACE_DX) return 'left'
  if (dx > TALK_FACE_DX) return 'right'
  const dy = targetY - fromY
  return dy < 0 ? 'back' : 'front'
}

export function talkFacingToward(
  fromX: number,
  fromY: number,
  targetX: number,
  targetY: number,
): { viewFacing: ChibiFacing; facing: 1 | -1 } {
  const viewFacing = resolveTalkViewFacing(fromX, fromY, targetX, targetY)
  return { viewFacing, facing: viewFacingToLR(viewFacing) }
}

export function isHorizontalWalk(dx: number, dy: number): boolean {
  return Math.abs(dx) >= Math.abs(dy)
}
