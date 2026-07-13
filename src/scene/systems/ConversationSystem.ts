import type { Agent } from '@/types/agent'
import { CHAT_HANDOFF_PAIRS } from '@/scene/layout/officeLayout'
import type { AgentEntity } from '@/scene/entities/AgentEntity'
import { talkFacingToward } from '@/scene/systems/movementFacing'

export interface ConversationPair {
  a: string
  b: string
  lineA: string
  lineB: string
}

export class ConversationSystem {
  private cooldown = 0
  private enabled = true

  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  tick(dt: number, agents: Agent[]): ConversationPair | null {
    if (!this.enabled) return null

    this.cooldown -= dt
    if (this.cooldown > 0) return null
    if (Math.random() > 0.015) return null

    const available = agents.filter(
      (a) =>
        !a.mission &&
        (a.state === 'idle' || a.state === 'working'),
    )
    if (available.length < 2) return null

    const shuffled = [...available].sort(() => Math.random() - 0.5)
    const a = shuffled[0]
    const b = shuffled.find(
      (other) =>
        other.id !== a.id &&
        Math.hypot(other.x - a.x, other.y - a.y) < 200,
    ) ?? shuffled[1]

    if (!b || a.id === b.id) return null

    const pair =
      CHAT_HANDOFF_PAIRS[
        Math.floor(Math.random() * CHAT_HANDOFF_PAIRS.length)
      ]!
    const [lineA, lineB] = pair

    this.cooldown = 8 + Math.random() * 6
    return { a: a.id, b: b.id, lineA, lineB }
  }

  applyConversation(
    entities: Map<string, AgentEntity>,
    pair: ConversationPair,
  ) {
    const entityA = entities.get(pair.a)
    const entityB = entities.get(pair.b)
    if (!entityA || !entityB) return

    const a = entityA.data
    const b = entityB.data
    entityA.apply({
      state: 'talking',
      currentTask: undefined,
      ...talkFacingToward(a.x, a.y, b.x, b.y),
    })
    entityB.apply({
      state: 'talking',
      currentTask: undefined,
      ...talkFacingToward(b.x, b.y, a.x, a.y),
    })
    entityA.showBubble(pair.lineA, 5)
    setTimeout(() => entityB.showBubble(pair.lineB, 5), 600)
  }

  endConversation(entities: Map<string, AgentEntity>, agentIds: string[]) {
    for (const id of agentIds) {
      const e = entities.get(id)
      if (!e || e.data.state !== 'talking') continue
      e.apply({ state: 'idle', currentTask: undefined })
      e.hideBubble()
    }
  }
}
