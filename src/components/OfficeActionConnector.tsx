import { useEffect, useRef } from 'react'
import {
  isWebSocketActionSource,
  OFFICE_WS_URL,
} from '@/config/officeMode'
import { OfficeActionWsClient } from '@/services/officeActionWs'

/** WebSocket 模式下连接外部动作源；demo 模式不生效 */
export function OfficeActionConnector() {
  const clientRef = useRef<OfficeActionWsClient | null>(null)

  useEffect(() => {
    if (!isWebSocketActionSource()) return

    const client = new OfficeActionWsClient()
    clientRef.current = client
    client.connect(OFFICE_WS_URL)

    return () => {
      client.disconnect()
      clientRef.current = null
    }
  }, [])

  return null
}
