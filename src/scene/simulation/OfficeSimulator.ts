import type { Agent } from '@/types/agent'
import {
  AGENT_ROSTER,
  DESKS,
  HANDOFF_STATUS,
} from '@/scene/layout/officeLayout'
import {
  agentHasActiveMission,
  processDeskVisitMissions,
  startDeskVisit,
  startDeskVisitTour,
  type DeskVisitMessageFn,
} from '@/scene/simulation/deskVisit'
import type { AgentEntity } from '@/scene/entities/AgentEntity'
import { talkFacingToward } from '@/scene/systems/movementFacing'

export class OfficeSimulator {
  tick(_dt: number, agents: Agent[]): Agent[] {
    const next = agents.map((a) => ({ ...a }))
    return this.pinAmbientAgents(next)
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
      // 有任务或正在走路的小人不钉座位（走路插值由 MovementSystem 驱动）
      if (
        agentHasActiveMission(agent) ||
        agent.state === 'walking' ||
        agent.walkPath != null
      ) {
        return agent
      }

      const desk = this.deskFor(agent)
      const roster = AGENT_ROSTER.find((r) => r.id === agent.id)
      const visitor = visitorByHost.get(agent.id)
      const toward = visitor
        ? talkFacingToward(agent.x, agent.y, visitor.x, visitor.y)
        : agent.customAnimation
          ? { viewFacing: 'front' as const, facing: 1 as const }
        : { viewFacing: 'back' as const, facing: 1 as const }

      const state =
        visitor
          ? ('talking' as const)
          : agent.customAnimation
            ? ('talking' as const)
          : agent.state === 'thinking' || agent.state === 'idle'
            ? agent.state
            : ('working' as const)

      return {
        ...agent,
        x: desk.seatX,
        y: desk.seatY,
        state,
        viewFacing: toward.viewFacing,
        facing: toward.facing,
        currentTask: visitor
          ? HANDOFF_STATUS.receiving
          : state === 'idle'
            ? undefined
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

  private deskFor(agent: Agent) {
    const id = agent.assignedDeskId
    return DESKS.find((d) => d.id === id) ?? DESKS[0]
  }
}
