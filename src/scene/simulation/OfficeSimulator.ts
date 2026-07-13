import type { Agent } from '@/types/agent'
import {
  ACTION_TASKS,
  AGENT_ROSTER,
  DESKS,
  HANDOFF_STATUS,
} from '@/scene/layout/officeLayout'
import {
  pickCorridorDestination,
  planWalkFrom,
  planWalkToDeskSeat,
} from '@/scene/navigation/officeNavigation'
import {
  agentHasActiveMission,
  processDeskVisitMissions,
  startDeskVisit,
  startDeskVisitTour,
  type DeskVisitMessageFn,
} from '@/scene/simulation/deskVisit'
import type { AgentEntity } from '@/scene/entities/AgentEntity'
import { MovementSystem } from '@/scene/systems/MovementSystem'
import { talkFacingToward } from '@/scene/systems/movementFacing'

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export class OfficeSimulator {
  private behaviorTimer = 0
  private talkingTimers = new Map<string, number>()
  /** 为 true 时不触发随机走动/闲聊（仅 mission 驱动移动） */
  private ambientFrozen = false

  setAmbientFrozen(frozen: boolean) {
    this.ambientFrozen = frozen
  }

  tick(dt: number, agents: Agent[]): Agent[] {
    const next = agents.map((a) => ({ ...a }))

    if (this.ambientFrozen) {
      return this.pinAmbientAgents(next)
    }

    this.behaviorTimer -= dt

    for (const agent of next) {
      if (agent.state === 'talking' && !agentHasActiveMission(agent)) {
        const t = (this.talkingTimers.get(agent.id) ?? 5) - dt
        this.talkingTimers.set(agent.id, t)
        if (t <= 0) {
          agent.state = 'idle'
          agent.bubbleText = undefined
          this.talkingTimers.delete(agent.id)
        }
      }
    }

    if (this.behaviorTimer <= 0) {
      this.behaviorTimer = 2 + Math.random() * 3
      this.scheduleRandomBehaviors(next)
    }

    return next
  }

  /** 无任务员工固定在工位办公 */
  private pinAmbientAgents(agents: Agent[]): Agent[] {
    const visitorByHost = new Map<string, Agent>()
    for (const a of agents) {
      const m = a.mission
      if (m?.kind === 'desk_visit' && m.phase === 'talk') {
        visitorByHost.set(m.hostAgentId, a)
      }
    }

    return agents.map((agent) => {
      if (agentHasActiveMission(agent)) return agent

      const desk = this.deskFor(agent)
      const roster = AGENT_ROSTER.find((r) => r.id === agent.id)
      const visitor = visitorByHost.get(agent.id)
      const toward = visitor
        ? talkFacingToward(agent.x, agent.y, visitor.x, visitor.y)
        : { viewFacing: 'back' as const, facing: 1 as const }

      return {
        ...agent,
        x: desk.seatX,
        y: desk.seatY,
        state: visitor ? ('talking' as const) : ('working' as const),
        viewFacing: toward.viewFacing,
        facing: toward.facing,
        currentTask: visitor
          ? HANDOFF_STATUS.receiving
          : (agent.currentTask ?? roster?.task),
        targetX: undefined,
        targetY: undefined,
        walkPath: undefined,
        walkPathIndex: undefined,
        bubbleText: undefined,
      }
    })
  }

  /** @param rosterNo 名册序号，从 1 开始 */
  startDeskVisit(
    agents: Agent[],
    visitorRosterNo: number,
    hostRosterNo: number,
    message: string,
  ): Agent[] {
    return startDeskVisit(agents, visitorRosterNo, hostRosterNo, message)
  }

  startDeskVisitTour(
    agents: Agent[],
    visitorRosterNo: number,
    hostRosterNos: number[],
    messageFn?: DeskVisitMessageFn,
  ): Agent[] {
    return startDeskVisitTour(agents, visitorRosterNo, hostRosterNos, messageFn)
  }

  afterMovement(
    dt: number,
    agents: Agent[],
    entities: Map<string, AgentEntity>,
  ): Agent[] {
    return processDeskVisitMissions(dt, agents, entities)
  }

  startConversation(agents: Agent[], aId: string, bId: string): Agent[] {
    const peer = (selfId: string) =>
      agents.find((a) => a.id === (selfId === aId ? bId : aId))

    return agents.map((agent) => {
      if (agent.id === aId || agent.id === bId) {
        this.talkingTimers.set(agent.id, 5 + Math.random() * 2)
        const other = peer(agent.id)
        const toward = other
          ? talkFacingToward(agent.x, agent.y, other.x, other.y)
          : { viewFacing: 'front' as const, facing: 1 as const }
        return {
          ...agent,
          state: 'talking' as const,
          currentTask: undefined,
          targetX: undefined,
          targetY: undefined,
          walkPath: undefined,
          walkPathIndex: undefined,
          viewFacing: toward.viewFacing,
          facing: toward.facing,
        }
      }
      return agent
    })
  }

  private scheduleRandomBehaviors(agents: Agent[]) {
    const idleOrDone = agents.filter(
      (a) =>
        a.state === 'idle' ||
        a.state === 'working' ||
        a.state === 'thinking',
    )

    for (const agent of idleOrDone) {
      if (
        agentHasActiveMission(agent) ||
        agent.state === 'walking' ||
        agent.state === 'talking' ||
        agent.targetX != null
      ) {
        continue
      }
      if (Math.random() > 0.42) continue

      const roll = Math.random()
      if (roll < 0.42) {
        this.sendToHomeDesk(agent)
      } else if (roll < 0.72) {
        this.sendToCorridor(agent)
      } else if (roll < 0.88) {
        this.startWorking(agent)
      } else {
        agent.state = 'thinking'
        agent.currentTask = HANDOFF_STATUS.planning
        const desk = this.deskFor(agent)
        agent.assignedDeskId = desk.id
        agent.viewFacing = 'back'
        agent.x = desk.seatX
        agent.y = desk.seatY
      }
    }
  }

  private deskFor(agent: Agent) {
    const id = agent.assignedDeskId
    return DESKS.find((d) => d.id === id) ?? DESKS[0]
  }

  /** 沿过道前往休闲/过道节点 */
  private sendToCorridor(agent: Agent) {
    const dest = pickCorridorDestination()
    const path = planWalkFrom(agent.x, agent.y, dest.x, dest.y)
    Object.assign(agent, MovementSystem.assignWalkPath(agent, path))
  }

  /** 沿过道回工位 */
  private sendToHomeDesk(agent: Agent) {
    const desk = this.deskFor(agent)
    const path = planWalkToDeskSeat(agent.x, agent.y, desk)
    Object.assign(agent, MovementSystem.assignWalkPath(agent, path))
  }

  private startWorking(agent: Agent) {
    const desk = this.deskFor(agent)
    agent.state = 'working'
    agent.currentTask = pick(ACTION_TASKS)
    agent.viewFacing = 'back'
    agent.x = desk.seatX
    agent.y = desk.seatY
    agent.targetX = undefined
    agent.targetY = undefined
    agent.walkPath = undefined
    agent.walkPathIndex = undefined
  }
}
