import type { AgentEntity } from '@/scene/entities/AgentEntity'

/** 驱动 Spine 动画切换；骨骼动画自带位移，不再使用 bob */
export class AnimationSystem {
  update(entities: Map<string, AgentEntity>, dt: number) {
    for (const entity of entities.values()) {
      entity.updateVisuals(entity.data.state, dt)
    }
  }
}
