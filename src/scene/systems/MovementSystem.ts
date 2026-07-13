import type { Agent } from '@/types/agent'
import type { AgentEntity } from '@/scene/entities/AgentEntity'
import {
  ACTION_TASKS,
  DESKS,
} from '@/scene/layout/officeLayout'
import {
  resolveWalkViewFacing,
  viewFacingToLR,
} from '@/scene/systems/movementFacing'

const ARRIVE_THRESHOLD = 6
const WALK_SPEED = 90

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function isHomeDeskSeat(deskId: string | undefined, x: number, y: number): boolean {
  if (!deskId) return false
  const desk = DESKS.find((d) => d.id === deskId)
  if (!desk) return false
  return Math.hypot(x - desk.seatX, y - desk.seatY) < ARRIVE_THRESHOLD + 8
}

export class MovementSystem {
  update(entities: Map<string, AgentEntity>, dt: number): boolean {
    let anyMoving = false

    for (const entity of entities.values()) {
      const agent = entity.data
      if (agent.state !== 'walking' || agent.targetX == null || agent.targetY == null) {
        continue
      }

      anyMoving = true
      const dx = agent.targetX - agent.x
      const dy = agent.targetY - agent.y
      const dist = Math.hypot(dx, dy)

      if (dist < ARRIVE_THRESHOLD) {
        const tx = agent.targetX
        const ty = agent.targetY
        const hasMore =
          agent.walkPath != null &&
          agent.walkPathIndex != null &&
          agent.walkPathIndex < agent.walkPath.length - 1

        if (hasMore) {
          const nextIndex = agent.walkPathIndex! + 1
          const next = agent.walkPath![nextIndex]
          const ndx = next.x - tx
          const ndy = next.y - ty
          const viewFacing = resolveWalkViewFacing(ndx, ndy)
          entity.apply({
            x: tx,
            y: ty,
            walkPathIndex: nextIndex,
            targetX: next.x,
            targetY: next.y,
            viewFacing,
            facing: viewFacingToLR(viewFacing),
          })
          entity.setPosition(tx, ty)
          continue
        }

        const atHome = isHomeDeskSeat(agent.assignedDeskId, tx, ty)
        const viewFacing = atHome ? 'back' : resolveWalkViewFacing(dx, dy)
        entity.apply({
          x: tx,
          y: ty,
          targetX: undefined,
          targetY: undefined,
          walkPath: undefined,
          walkPathIndex: undefined,
          state: atHome ? 'working' : 'idle',
          viewFacing,
          facing: viewFacingToLR(viewFacing),
          currentTask: atHome
            ? (agent.currentTask ?? pick(ACTION_TASKS))
            : undefined,
        })
        entity.setPosition(tx, ty)
        continue
      }

      const step = Math.min(WALK_SPEED * dt, dist)
      const nx = agent.x + (dx / dist) * step
      const ny = agent.y + (dy / dist) * step
      const viewFacing = resolveWalkViewFacing(dx, dy)

      entity.apply({
        x: nx,
        y: ny,
        viewFacing,
        facing: viewFacingToLR(viewFacing),
      })
      entity.setPosition(nx, ny)
    }

    return anyMoving
  }

  static assignWalkPath(
    agent: Agent,
    points: { x: number; y: number }[],
  ): Agent {
    if (points.length === 0) return agent
    const first = points[0]
    const dx = first.x - agent.x
    const dy = first.y - agent.y
    const viewFacing = resolveWalkViewFacing(dx, dy)
    return {
      ...agent,
      state: 'walking',
      walkPath: points,
      walkPathIndex: 0,
      targetX: first.x,
      targetY: first.y,
      currentTask: undefined,
      bubbleText: undefined,
      viewFacing,
      facing: viewFacingToLR(viewFacing),
    }
  }
}
