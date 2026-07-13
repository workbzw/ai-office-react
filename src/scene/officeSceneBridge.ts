import type { OfficeScene } from '@/scene/OfficeScene'
import { submitVisitAction } from '@/services/officeActionDispatcher'
import type { VisitActionMessage } from '@/services/officeActionDispatcher'

let scene: OfficeScene | null = null

type PendingDeskVisit = {
  kind: 'desk_visit'
  visitorRosterNo: number
  hostRosterNo: number
  message: string
}

type PendingDeskVisitTour = {
  kind: 'desk_visit_tour'
  visitorRosterNo: number
  hostRosterNos: number[]
  messageFn?: (hostRosterNo: number, hostName: string) => string
}

type PendingAction = PendingDeskVisit | PendingDeskVisitTour

const pendingActions: PendingAction[] = []

function flushPendingActions() {
  if (!scene || pendingActions.length === 0) return

  const queue = pendingActions.splice(0)
  console.info('[OfficeWS] scene ready, flushing', queue.length, 'pending action(s)')
  for (const action of queue) {
    if (action.kind === 'desk_visit') {
      submitVisitAction({
        type: 'desk_visit',
        visitor: action.visitorRosterNo,
        host: action.hostRosterNo,
        message: action.message,
      })
    } else {
      submitVisitAction(
        {
          type: 'desk_visit_tour',
          visitor: action.visitorRosterNo,
          hosts: action.hostRosterNos,
        },
        { messageFn: action.messageFn },
      )
    }
  }
}

export function bindOfficeScene(instance: OfficeScene | null) {
  scene = instance
  if (instance) flushPendingActions()
}

/** 名册序号从 1 开始，例如 1 号去找 5 号 */
export function requestDeskVisit(
  visitorRosterNo: number,
  hostRosterNo: number,
  message: string,
) {
  if (!scene) {
    pendingActions.push({
      kind: 'desk_visit',
      visitorRosterNo,
      hostRosterNo,
      message,
    })
    console.info('[OfficeWS] scene not ready, pending desk_visit', {
      visitor: visitorRosterNo,
      host: hostRosterNo,
    })
    return
  }
  scene.requestDeskVisit(visitorRosterNo, hostRosterNo, message)
}

/** 1 号依次拜访 2、3、4… 号，全部说完后回座 */
export function requestDeskVisitTour(
  visitorRosterNo: number,
  hostRosterNos: number[],
  messageFn?: (hostRosterNo: number, hostName: string) => string,
) {
  if (!scene) {
    pendingActions.push({
      kind: 'desk_visit_tour',
      visitorRosterNo,
      hostRosterNos,
      messageFn,
    })
    console.info('[OfficeWS] scene not ready, pending desk_visit_tour', {
      visitor: visitorRosterNo,
      hosts: hostRosterNos,
    })
    return
  }
  scene.requestDeskVisitTour(visitorRosterNo, hostRosterNos, messageFn)
}

export function isOfficeSceneReady() {
  return scene != null
}

export type { VisitActionMessage }
