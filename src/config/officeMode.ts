/**
 * HTTP 拜访命令调度模式
 * - queue：入队串行，任务稀疏时不丢
 * - skip：繁忙时丢弃新命令，任务密集时减负
 * - hybrid：繁忙丢弃 + 空闲串行消费（不积压繁忙期命令）
 */
export type OfficeDispatchMode = 'queue' | 'skip' | 'hybrid'

const dispatchRaw = import.meta.env.VITE_OFFICE_DISPATCH_MODE

export const OFFICE_HTTP_ACTIONS_URL =
  import.meta.env.VITE_OFFICE_HTTP_ACTIONS_URL ?? '/api/actions'

export const OFFICE_DISPATCH_MODE: OfficeDispatchMode =
  dispatchRaw === 'skip' || dispatchRaw === 'hybrid'
    ? dispatchRaw
    : 'queue'
