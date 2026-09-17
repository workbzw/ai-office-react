import type { ChibiFacing } from '@/scene/characters/chibiAgentPresets'

export type AgentState =
  | 'idle'
  | 'walking'
  | 'working'
  | 'talking'
  | 'thinking'

export interface DeskVisitStop {
  hostRosterNo: number
  hostAgentId: string
  hostDeskId: string
  message: string
}

/** 工位拜访（可串联多站，最后一站后再回座） */
export interface DeskVisitMission {
  kind: 'desk_visit'
  phase: 'goto' | 'talk' | 'return'
  hostAgentId: string
  hostDeskId: string
  message: string
  resumeTask: string
  talkDuration: number
  talkRemaining?: number
  /** 当前站之后还要去的目标 */
  queue: DeskVisitStop[]
  /** return 阶段走回座位后要落入的状态(菜单改状态用) */
  landingState?: AgentState
  /** return 阶段走回座位后要播放的表情动画(菜单表情用) */
  landingAnimation?: string
}

export interface Agent {
  id: string
  name: string
  color: number
  x: number
  y: number
  targetX?: number
  targetY?: number
  /** 过道路径点队列（逐段行走） */
  walkPath?: { x: number; y: number }[]
  walkPathIndex?: number
  state: AgentState
  currentTask?: string
  assignedDeskId?: string
  bubbleText?: string
  customAnimation?: string
  /** 简笔 fallback 左右翻转 */
  facing: 1 | -1
  /** Spine 四向：走路时按位移更新 */
  viewFacing?: ChibiFacing
  mission?: DeskVisitMission
}

export interface Desk {
  id: string
  x: number
  y: number
  seatX: number
  seatY: number
  occupiedBy?: string
}
