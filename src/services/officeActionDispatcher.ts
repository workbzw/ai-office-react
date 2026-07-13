import {
  OFFICE_DISPATCH_MODE,
  type OfficeDispatchMode,
} from '@/config/officeMode'
import {
  requestDeskVisit,
  requestDeskVisitTour,
} from '@/scene/officeSceneBridge'
import { useOfficeStore } from '@/store/officeStore'
import type { Agent } from '@/types/agent'
import type {
  OfficeWsDeskVisit,
  OfficeWsDeskVisitTour,
} from '@/types/officeAction'

export type VisitActionMessage = OfficeWsDeskVisit | OfficeWsDeskVisitTour

const ROSTER_MIN = 1
const ROSTER_MAX = 6

const visitQueue: Array<{
  message: VisitActionMessage
  messageFn?: (hostRosterNo: number, hostName: string) => string
}> = []
let dispatchLocked = false
let wasMissionBusy = false
let skippedCount = 0
let invalidCount = 0
let completedCount = 0

function hasActiveVisitMission(agents: Agent[]): boolean {
  return agents.some((a) => a.mission?.kind === 'desk_visit')
}

function isDispatchBusy(agents: Agent[]): boolean {
  return dispatchLocked || hasActiveVisitMission(agents)
}

function normalizeVisitMessage(message: VisitActionMessage): VisitActionMessage | null {
  if (message.type === 'desk_visit') {
    const { visitor, host } = message
    if (
      visitor < ROSTER_MIN ||
      visitor > ROSTER_MAX ||
      host < ROSTER_MIN ||
      host > ROSTER_MAX ||
      visitor === host
    ) {
      return null
    }
    return message
  }

  const hosts = message.hosts.filter(
    (host) =>
      host >= ROSTER_MIN && host <= ROSTER_MAX && host !== message.visitor,
  )
  if (
    message.visitor < ROSTER_MIN ||
    message.visitor > ROSTER_MAX ||
    hosts.length === 0
  ) {
    return null
  }
  return { ...message, hosts }
}

function executeVisit(
  message: VisitActionMessage,
  messageFn?: (hostRosterNo: number, hostName: string) => string,
) {
  dispatchLocked = true

  if (message.type === 'desk_visit') {
    requestDeskVisit(message.visitor, message.host, message.message)
    return
  }
  requestDeskVisitTour(
    message.visitor,
    message.hosts,
    messageFn ?? (message.message ? () => message.message! : undefined),
  )
}

function drainQueueIfNeeded() {
  if (OFFICE_DISPATCH_MODE === 'skip') return
  tryDrainQueue()
}

function tryDrainQueue() {
  if (OFFICE_DISPATCH_MODE === 'skip') return

  const agents = useOfficeStore.getState().agents
  if (isDispatchBusy(agents)) return

  while (visitQueue.length > 0) {
    const peek = visitQueue[0]!
    const normalized = normalizeVisitMessage(peek.message)
    if (!normalized) {
      visitQueue.shift()
      invalidCount += 1
      console.warn('[OfficeDispatch] invalid visit command, skipped', peek.message)
      continue
    }

    visitQueue.shift()
    console.info(
      '[OfficeDispatch] executing',
      normalized,
      `remaining=${visitQueue.length}`,
      `completed=${completedCount}`,
    )
    executeVisit(normalized, peek.messageFn)
    return
  }
}

export function submitVisitAction(
  message: VisitActionMessage,
  options?: {
    messageFn?: (hostRosterNo: number, hostName: string) => string
  },
) {
  const normalized = normalizeVisitMessage(message)
  if (!normalized) {
    invalidCount += 1
    console.warn(
      '[OfficeDispatch] invalid visit command, rejected (名册仅 1–6，且 visitor≠host)',
      message,
    )
    return
  }

  const mode = OFFICE_DISPATCH_MODE
  const agents = useOfficeStore.getState().agents
  const busy = isDispatchBusy(agents)

  if (mode === 'skip') {
    if (busy) {
      skippedCount += 1
      console.info('[OfficeDispatch] skip: dropped (busy)', normalized, {
        skippedCount,
      })
      return
    }
    executeVisit(normalized, options?.messageFn)
    return
  }

  if (mode === 'hybrid' && busy) {
    skippedCount += 1
    console.info('[OfficeDispatch] hybrid: dropped (busy)', normalized, {
      skippedCount,
    })
    return
  }

  visitQueue.push({ message: normalized, messageFn: options?.messageFn })
  console.info('[OfficeDispatch] queue: enqueued', normalized, {
    depth: visitQueue.length,
    mode,
  })

  if (!busy) drainQueueIfNeeded()
}

/** 场景每帧同步后调用，mission 结束时触发队列消费 */
export function notifyVisitMissionActivity(agents: Agent[]) {
  const busy = hasActiveVisitMission(agents)

  if (wasMissionBusy && !busy) {
    dispatchLocked = false
    completedCount += 1
    console.info(
      '[OfficeDispatch] mission completed',
      `completed=${completedCount}`,
      `pending=${visitQueue.length}`,
    )
    drainQueueIfNeeded()
  } else if (
    !busy &&
    visitQueue.length > 0 &&
    dispatchLocked &&
    (OFFICE_DISPATCH_MODE === 'queue' || OFFICE_DISPATCH_MODE === 'hybrid')
  ) {
    dispatchLocked = false
    console.info(
      '[OfficeDispatch] idle with pending queue, resume drain',
      `pending=${visitQueue.length}`,
    )
    drainQueueIfNeeded()
  }

  if (busy) dispatchLocked = true
  wasMissionBusy = busy
}

export function getDispatchStats(): {
  mode: OfficeDispatchMode
  queueDepth: number
  executing: boolean
  skippedCount: number
  invalidCount: number
  completedCount: number
} {
  const agents = useOfficeStore.getState().agents
  return {
    mode: OFFICE_DISPATCH_MODE,
    queueDepth: visitQueue.length,
    executing: isDispatchBusy(agents),
    skippedCount,
    invalidCount,
    completedCount,
  }
}

export function dispatchModeLabel(mode: OfficeDispatchMode): string {
  switch (mode) {
    case 'queue':
      return '队列（不丢）'
    case 'skip':
      return '省略（繁忙丢弃）'
    case 'hybrid':
      return '混合（繁忙丢/空闲串行）'
  }
}
