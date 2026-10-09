import { OFFICE_HTTP_ACTIONS_URL } from '@/config/officeMode'
import { setAgentState } from '@/scene/officeSceneBridge'
import { submitVisitAction } from '@/services/officeActionDispatcher'
import { getOfficeAgents } from '@/store/officeStore'
import type { OfficeActionMessage } from '@/types/officeAction'

const POLL_MS = 1000

type ActionPollResponse =
  | OfficeActionMessage[]
  | {
      actions?: OfficeActionMessage[]
    }

export function dispatchOfficeAction(message: OfficeActionMessage) {
  console.info('[OfficeHTTP] received', message)

  switch (message.type) {
    case 'desk_visit':
      console.info('[OfficeHTTP] dispatch desk_visit', {
        visitor: message.visitor,
        host: message.host,
      })
      submitVisitAction(message)
      return
    case 'desk_visit_tour':
      console.info('[OfficeHTTP] dispatch desk_visit_tour', {
        visitor: message.visitor,
        hosts: message.hosts,
      })
      submitVisitAction(message)
      return
    case 'set_state': {
      const agents = getOfficeAgents()
      const agent = message.agentId
        ? agents.find((a) => a.id === message.agentId)
        : message.rosterNo != null
          ? agents[message.rosterNo - 1]
          : undefined
      if (!agent) {
        console.warn('[OfficeHTTP] set_state: agent not found', message)
        return
      }
      console.info('[OfficeHTTP] dispatch set_state', {
        agentId: agent.id,
        state: message.state,
      })
      setAgentState(agent.id, message.state, message.task)
      return
    }
    default: {
      const _exhaustive: never = message
      console.warn('[OfficeHTTP] unknown message type', _exhaustive)
    }
  }
}

function normalizePollResponse(data: ActionPollResponse): OfficeActionMessage[] {
  if (Array.isArray(data)) return data
  if (Array.isArray(data.actions)) return data.actions
  return []
}

export class OfficeActionHttpClient {
  private timer: ReturnType<typeof setTimeout> | null = null
  private abortController: AbortController | null = null
  private shouldPoll = false

  connect(url: string = OFFICE_HTTP_ACTIONS_URL) {
    this.shouldPoll = true
    void this.poll(url)
  }

  disconnect() {
    this.shouldPoll = false
    if (this.timer != null) clearTimeout(this.timer)
    this.timer = null
    this.abortController?.abort()
    this.abortController = null
  }

  private schedule(url: string) {
    if (!this.shouldPoll) return
    this.timer = setTimeout(() => void this.poll(url), POLL_MS)
  }

  private async poll(url: string) {
    if (!this.shouldPoll) return

    this.abortController = new AbortController()
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: this.abortController.signal,
      })

      if (!response.ok) {
        console.warn('[OfficeHTTP] poll failed', response.status, url)
        return
      }

      const data = (await response.json()) as ActionPollResponse
      const actions = normalizePollResponse(data)
      for (const action of actions) {
        dispatchOfficeAction(action)
        // 删除已执行的动作，避免重复执行
        const actionWithId = action as OfficeActionMessage & { _id?: number }
        if (actionWithId._id != null) {
          fetch(`${url}?id=${actionWithId._id}`, { method: 'DELETE' }).catch(() => {})
        }
      }
    } catch (error) {
      if (this.shouldPoll) {
        console.warn('[OfficeHTTP] poll error', url, error)
      }
    } finally {
      this.abortController = null
      this.schedule(url)
    }
  }
}
