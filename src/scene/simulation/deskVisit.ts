import type { Agent, Desk, DeskVisitMission, DeskVisitStop } from '@/types/agent'
import {
  AGENT_ROSTER,
  DESKS,
  HANDOFF_STATUS,
  pickHandoffVisitMessage,
} from '@/scene/layout/officeLayout'
import {
  createNavContext,
  planWalkToDeskSeat,
  planWalkToDeskVisit,
} from '@/scene/navigation/officeNavigation'
import { MovementSystem } from '@/scene/systems/MovementSystem'
import type { AgentEntity } from '@/scene/entities/AgentEntity'
import { talkFacingToward } from '@/scene/systems/movementFacing'

const DEFAULT_TALK_SEC = 3.5

export function rosterAgentAt(agents: Agent[], rosterNo: number): Agent | undefined {
  const i = rosterNo - 1
  if (i < 0 || i >= agents.length) return undefined
  return agents[i]
}

export function deskForAgent(agent: Agent): Desk {
  return (
    DESKS.find((d) => d.id === agent.assignedDeskId) ??
    DESKS[AGENT_ROSTER.findIndex((r) => r.id === agent.id)] ??
    DESKS[0]
  )
}

export type DeskVisitMessageFn = (
  hostRosterNo: number,
  hostName: string,
) => string

function defaultVisitMessage(hostRosterNo: number, hostName: string): string {
  return pickHandoffVisitMessage(hostName, hostRosterNo)
}

function buildStops(
  agents: Agent[],
  hostRosterNos: number[],
  messageFn: DeskVisitMessageFn,
): DeskVisitStop[] {
  const stops: DeskVisitStop[] = []
  for (const rosterNo of hostRosterNos) {
    const host = rosterAgentAt(agents, rosterNo)
    if (!host) continue
    const name = AGENT_ROSTER[rosterNo - 1]?.name ?? `#${rosterNo}`
    stops.push({
      hostRosterNo: rosterNo,
      hostAgentId: host.id,
      hostDeskId: deskForAgent(host).id,
      message: messageFn(rosterNo, name),
    })
  }
  return stops
}

function assignGotoHost(
  agent: Agent,
  stop: DeskVisitStop,
  agents: Agent[],
): Agent {
  const hostDesk = DESKS.find((d) => d.id === stop.hostDeskId)!
  const visitorDesk = deskForAgent(agent)
  const nav = createNavContext(agents, agent.id)
  const path = planWalkToDeskVisit(
    agent.x,
    agent.y,
    hostDesk,
    visitorDesk,
    nav,
  )
  const walking = MovementSystem.assignWalkPath(agent, path)
  return {
    ...walking,
    bubbleText: undefined,
    currentTask: HANDOFF_STATUS.delivering,
  }
}

function missionForStops(
  stops: DeskVisitStop[],
  resumeTask: string,
  talkDuration: number,
): DeskVisitMission | null {
  if (stops.length === 0) return null
  const [current, ...queue] = stops
  return {
    kind: 'desk_visit',
    phase: 'goto',
    hostAgentId: current.hostAgentId,
    hostDeskId: current.hostDeskId,
    message: current.message,
    resumeTask,
    talkDuration,
    queue,
  }
}

/** 单站拜访 */
export function startDeskVisit(
  agents: Agent[],
  visitorRosterNo: number,
  hostRosterNo: number,
  message: string,
  talkDuration = DEFAULT_TALK_SEC,
): Agent[] {
  return startDeskVisitTour(
    agents,
    visitorRosterNo,
    [hostRosterNo],
    () => message,
    talkDuration,
  )
}

/** 按顺序串联多站，全部完成后回访客工位 */
export function startDeskVisitTour(
  agents: Agent[],
  visitorRosterNo: number,
  hostRosterNos: number[],
  messageFn: DeskVisitMessageFn = defaultVisitMessage,
  talkDuration = DEFAULT_TALK_SEC,
): Agent[] {
  const visitor = rosterAgentAt(agents, visitorRosterNo)
  if (!visitor || hostRosterNos.length === 0) return agents

  const stops = buildStops(agents, hostRosterNos, messageFn).filter(
    (s) => s.hostAgentId !== visitor.id,
  )
  const mission = missionForStops(
    stops,
    visitor.currentTask ??
      AGENT_ROSTER[visitorRosterNo - 1]?.task ??
      '工作中…',
    talkDuration,
  )
  if (!mission) return agents

  const firstStop = stops[0]!
  return agents.map((a) => {
    if (a.id !== visitor.id) return a
    const going = assignGotoHost(a, firstStop, agents)
    return { ...going, mission }
  })
}

/** 工位拜访 talk 阶段：访客与被访者同步为 talking；结束后释放 stale 状态 */
function syncDeskVisitTalkPartners(agents: Agent[]): Agent[] {
  const hostToVisitor = new Map<string, Agent>()
  for (const a of agents) {
    const m = a.mission
    if (m?.kind === 'desk_visit' && m.phase === 'talk') {
      hostToVisitor.set(m.hostAgentId, a)
    }
  }

  let result = agents.map((agent) => {
    const mission = agent.mission
    if (mission?.kind === 'desk_visit' && mission.phase === 'talk') {
      const host = agents.find((a) => a.id === mission.hostAgentId)
      const toward = host
        ? talkFacingToward(agent.x, agent.y, host.x, host.y)
        : {}
      return {
        ...agent,
        ...toward,
        state: 'talking' as const,
        currentTask: HANDOFF_STATUS.handingOff,
      }
    }

    const visitor = hostToVisitor.get(agent.id)
    if (visitor) {
      return {
        ...agent,
        ...talkFacingToward(agent.x, agent.y, visitor.x, visitor.y),
        state: 'talking' as const,
        currentTask: HANDOFF_STATUS.receiving,
      }
    }

    return agent
  })

  const activeTalkIds = new Set<string>()
  for (const [hostId, visitor] of hostToVisitor) {
    activeTalkIds.add(hostId)
    activeTalkIds.add(visitor.id)
  }

  result = result.map((agent) => {
    if (activeTalkIds.has(agent.id)) return agent

    const mission = agent.mission
    const roster = AGENT_ROSTER.find((r) => r.id === agent.id)

    if (mission?.kind === 'desk_visit' && mission.phase !== 'talk') {
      if (agent.state !== 'talking') return agent
      if (mission.phase === 'return' && agent.targetX != null) {
        return {
          ...agent,
          state: 'walking' as const,
          currentTask: HANDOFF_STATUS.wrappingUp,
        }
      }
      if (mission.phase === 'goto') {
        return {
          ...agent,
          state: 'walking' as const,
          currentTask: HANDOFF_STATUS.delivering,
        }
      }
      return {
        ...agent,
        state: 'working' as const,
        viewFacing: 'back' as const,
        currentTask: mission.resumeTask ?? roster?.task ?? agent.currentTask,
        bubbleText: undefined,
      }
    }

    if (agent.state === 'talking' && !agent.mission) {
      return {
        ...agent,
        state: 'working' as const,
        viewFacing: 'back' as const,
        currentTask: roster?.task ?? agent.currentTask,
        bubbleText: undefined,
      }
    }

    return agent
  })

  return result
}

export function processDeskVisitMissions(
  dt: number,
  agents: Agent[],
  entities: Map<string, AgentEntity>,
): Agent[] {
  const processed = agents.map((agent) => {
    const mission = agent.mission
    if (!mission || mission.kind !== 'desk_visit') {
      return agent
    }

    if (mission.phase === 'goto') {
      if (agent.state === 'walking' || agent.targetX != null) return agent

      const host = agents.find((a) => a.id === mission.hostAgentId)
      const toward = host
        ? talkFacingToward(agent.x, agent.y, host.x, host.y)
        : { viewFacing: 'front' as const, facing: 1 as const }

      entities.get(agent.id)?.showBubble(mission.message, mission.talkDuration)

      return {
        ...agent,
        state: 'talking' as const,
        currentTask: HANDOFF_STATUS.handingOff,
        viewFacing: toward.viewFacing,
        facing: toward.facing,
        mission: {
          ...mission,
          phase: 'talk' as const,
          talkRemaining: mission.talkDuration,
        },
      }
    }

    if (mission.phase === 'talk') {
      const host = agents.find((a) => a.id === mission.hostAgentId)
      const toward = host
        ? talkFacingToward(agent.x, agent.y, host.x, host.y)
        : null
      const left = (mission.talkRemaining ?? mission.talkDuration) - dt
      if (left > 0) {
        return {
          ...agent,
          ...(toward ?? {}),
          state: 'talking' as const,
          currentTask: HANDOFF_STATUS.handingOff,
          mission: { ...mission, talkRemaining: left } satisfies DeskVisitMission,
        }
      }

      entities.get(agent.id)?.hideBubble()

      if (mission.queue.length > 0) {
        const [next, ...queue] = mission.queue
        const going = assignGotoHost(
          { ...agent, bubbleText: undefined },
          next,
          agents,
        )
        return {
          ...going,
          mission: {
            ...mission,
            phase: 'goto' as const,
            hostAgentId: next.hostAgentId,
            hostDeskId: next.hostDeskId,
            message: next.message,
            queue,
            talkRemaining: undefined,
          },
        }
      }

      const home = deskForAgent(agent)
      const ctx = createNavContext(agents, agent.id)
      const path = planWalkToDeskSeat(agent.x, agent.y, home, ctx)
      const walking = MovementSystem.assignWalkPath(
        { ...agent, bubbleText: undefined },
        path,
      )
      return {
        ...walking,
        currentTask: HANDOFF_STATUS.wrappingUp,
        mission: { ...mission, phase: 'return' as const },
      }
    }

    if (mission.phase === 'return') {
      if (agent.state === 'walking' || agent.targetX != null) {
        return {
          ...agent,
          state: 'walking' as const,
          currentTask: HANDOFF_STATUS.wrappingUp,
        }
      }

      const rest = { ...agent }
      delete rest.mission
      return {
        ...rest,
        state: 'working' as const,
        viewFacing: 'back' as const,
        currentTask: mission.resumeTask,
        bubbleText: undefined,
      }
    }

    return agent
  })

  return syncDeskVisitTalkPartners(processed)
}

export function agentHasActiveMission(agent: Agent): boolean {
  return agent.mission != null
}
