import { create } from 'zustand'
import type { Agent, AgentState } from '@/types/agent'
import { AGENT_COUNT, INITIAL_AGENTS } from '@/scene/layout/officeLayout'
import {
  requestDeskVisit as bridgeDeskVisit,
  requestDeskVisitTour as bridgeDeskVisitTour,
} from '@/scene/officeSceneBridge'

interface OfficeStats {
  tokensUsed: number
  tokensSaved: number
  inProgress: number
  completed: number
  total: number
}

interface OfficeStore {
  agents: Agent[]
  stats: OfficeStats
  tick: number

  setAgents: (agents: Agent[]) => void
  updateAgent: (id: string, patch: Partial<Agent>) => void
  setAgentState: (id: string, state: AgentState, task?: string) => void
  incrementTick: () => void
  bumpStats: () => void
  /** 名册序号从 1 开始 */
  requestDeskVisit: (
    visitorRosterNo: number,
    hostRosterNo: number,
    message: string,
  ) => void
  requestDeskVisitTour: (
    visitorRosterNo: number,
    hostRosterNos: number[],
    messageFn?: (hostRosterNo: number, hostName: string) => string,
  ) => void
}

const workingCount = (agents: Agent[]) =>
  agents.filter((a) => a.state === 'working' || a.state === 'thinking').length

export const useOfficeStore = create<OfficeStore>((set, get) => ({
  agents: INITIAL_AGENTS.map((a) => ({ ...a })),
  stats: {
    tokensUsed: 12840,
    tokensSaved: 5620,
    inProgress: workingCount(INITIAL_AGENTS),
    completed: 8,
    total: AGENT_COUNT,
  },
  tick: 0,

  setAgents: (agents) =>
    set({
      agents,
      stats: {
        ...get().stats,
        inProgress: workingCount(agents),
      },
    }),

  updateAgent: (id, patch) => {
    const agents = get().agents.map((a) =>
      a.id === id ? { ...a, ...patch } : a,
    )
    set({
      agents,
      stats: { ...get().stats, inProgress: workingCount(agents) },
    })
  },

  setAgentState: (id, state, task) => {
    get().updateAgent(id, {
      state,
      currentTask: task,
      bubbleText: state === 'talking' ? undefined : undefined,
    })
  },

  incrementTick: () => set((s) => ({ tick: s.tick + 1 })),

  bumpStats: () =>
    set((s) => ({
      stats: {
        ...s.stats,
        tokensUsed: s.stats.tokensUsed + Math.floor(Math.random() * 80 + 20),
        tokensSaved: s.stats.tokensSaved + Math.floor(Math.random() * 40 + 5),
        completed:
          Math.random() > 0.92 ? s.stats.completed + 1 : s.stats.completed,
      },
    })),

  requestDeskVisit: (visitorRosterNo, hostRosterNo, message) => {
    bridgeDeskVisit(visitorRosterNo, hostRosterNo, message)
  },

  requestDeskVisitTour: (visitorRosterNo, hostRosterNos, messageFn) => {
    bridgeDeskVisitTour(visitorRosterNo, hostRosterNos, messageFn)
  },
}))
