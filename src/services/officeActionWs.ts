import { OFFICE_WS_URL } from '@/config/officeMode'
import { submitVisitAction } from '@/services/officeActionDispatcher'
import { useOfficeStore } from '@/store/officeStore'
import type { OfficeWsMessage } from '@/types/officeAction'

const RECONNECT_MS = 3000

export function dispatchOfficeAction(message: OfficeWsMessage) {
  console.info('[OfficeWS] received', message)
  const store = useOfficeStore.getState()

  switch (message.type) {
    case 'desk_visit':
      console.info('[OfficeWS] dispatch desk_visit', {
        visitor: message.visitor,
        host: message.host,
      })
      submitVisitAction(message)
      return
    case 'desk_visit_tour':
      console.info('[OfficeWS] dispatch desk_visit_tour', {
        visitor: message.visitor,
        hosts: message.hosts,
      })
      submitVisitAction(message)
      return
    case 'set_state': {
      const agent = message.agentId
        ? store.agents.find((a) => a.id === message.agentId)
        : message.rosterNo != null
          ? store.agents[message.rosterNo - 1]
          : undefined
      if (!agent) {
        console.warn('[OfficeWS] set_state: agent not found', message)
        return
      }
      console.info('[OfficeWS] dispatch set_state', {
        agentId: agent.id,
        state: message.state,
      })
      store.setAgentState(agent.id, message.state, message.task)
      return
    }
    default: {
      const _exhaustive: never = message
      console.warn('[OfficeWS] unknown message type', _exhaustive)
    }
  }
}

export class OfficeActionWsClient {
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private shouldConnect = false

  connect(url: string = OFFICE_WS_URL) {
    this.shouldConnect = true
    this.open(url)
  }

  disconnect() {
    this.shouldConnect = false
    if (this.reconnectTimer != null) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    this.ws?.close()
    this.ws = null
  }

  private open(url: string) {
    if (this.ws) {
      this.ws.onclose = null
      this.ws.close()
    }

    const ws = new WebSocket(url)
    this.ws = ws

    ws.onopen = () => {
      console.info('[OfficeWS] connected', url)
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as OfficeWsMessage
        dispatchOfficeAction(message)
      } catch (error) {
        console.warn('[OfficeWS] invalid message', event.data, error)
      }
    }

    ws.onerror = () => {
      console.warn('[OfficeWS] connection error', url)
    }

    ws.onclose = () => {
      this.ws = null
      console.info('[OfficeWS] disconnected')
      if (!this.shouldConnect) return
      this.reconnectTimer = setTimeout(() => this.open(url), RECONNECT_MS)
    }
  }
}
