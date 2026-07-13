/** 员工动作来源：demo=本地市场部演示，websocket=外部 WebSocket 推送 */
export type OfficeActionSource = 'demo' | 'websocket'

/**
 * WebSocket 拜访命令调度模式
 * - queue：入队串行，任务稀疏时不丢
 * - skip：繁忙时丢弃新命令，任务密集时减负
 * - hybrid：繁忙丢弃 + 空闲串行消费（不积压繁忙期命令）
 */
export type OfficeDispatchMode = 'queue' | 'skip' | 'hybrid'

const raw = import.meta.env.VITE_OFFICE_ACTION_SOURCE
const dispatchRaw = import.meta.env.VITE_OFFICE_DISPATCH_MODE

export const OFFICE_ACTION_SOURCE: OfficeActionSource =
  raw === 'websocket' ? 'websocket' : 'demo'

export const OFFICE_WS_URL =
  import.meta.env.VITE_OFFICE_WS_URL ?? 'ws://localhost:8765'

export const OFFICE_DISPATCH_MODE: OfficeDispatchMode =
  dispatchRaw === 'skip' || dispatchRaw === 'hybrid'
    ? dispatchRaw
    : 'queue'

export const isDemoActionSource = () => OFFICE_ACTION_SOURCE === 'demo'

export const isWebSocketActionSource = () =>
  OFFICE_ACTION_SOURCE === 'websocket'
