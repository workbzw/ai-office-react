import type { AgentState } from '@/types/agent'

export type OfficeWsDeskVisit = {
  type: 'desk_visit'
  visitor: number
  host: number
  message: string
}

export type OfficeWsDeskVisitTour = {
  type: 'desk_visit_tour'
  visitor: number
  hosts: number[]
  message?: string
}

export type OfficeWsSetState = {
  type: 'set_state'
  state: AgentState
  task?: string
  /** 名册序号，从 1 开始 */
  rosterNo?: number
  agentId?: string
}

export type OfficeWsMessage =
  | OfficeWsDeskVisit
  | OfficeWsDeskVisitTour
  | OfficeWsSetState
