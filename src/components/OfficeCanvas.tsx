import { useEffect, useRef } from 'react'
import { OfficeScene } from '@/scene/OfficeScene'

export function OfficeCanvas() {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<OfficeScene | null>(null)
  const readyRef = useRef(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const scene = new OfficeScene()
    sceneRef.current = scene

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      if (width <= 0 || height <= 0) return

      if (!readyRef.current) {
        readyRef.current = true
        void scene.init(host, width, height)
        return
      }

      sceneRef.current?.resize(width, height)
    })

    ro.observe(host)

    return () => {
      ro.disconnect()
      readyRef.current = false
      scene.destroy()
      sceneRef.current = null
    }
  }, [])

  return <div ref={hostRef} className="office-canvas" />
}
