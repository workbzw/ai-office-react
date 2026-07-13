import { Skin } from '@esotericsoftware/spine-pixi-v8'
import type { SkeletonData } from '@esotericsoftware/spine-core'

/** Spine 官方 Mix-and-Match 示例（免费）：每位 Agent 一套完整外观 */
const AGENT_FULL_SKINS: Record<string, string> = {
  marvis: 'full-skins/girl-spring-dress',
  'file-agent': 'full-skins/girl-blue-cape',
  'app-agent': 'full-skins/boy',
  'data-agent': 'full-skins/girl',
}

const FALLBACK_PARTS = [
  'skin-base',
  'nose/short',
  'eyes/violet',
  'eyelids/girly',
  'hair/brown',
  'clothes/hoodie-blue-and-scarf',
  'legs/pants-jeans',
  'accessories/bag',
] as const

export function resolveMixAndMatchSkin(
  data: SkeletonData,
  agentId: string,
): Skin | null {
  const fullName = AGENT_FULL_SKINS[agentId]
  if (fullName) {
    const full = data.findSkin(fullName)
    if (full) return full
  }

  const custom = new Skin(`agent-${agentId}`)
  for (const part of FALLBACK_PARTS) {
    const piece = data.findSkin(part)
    if (piece) custom.addSkin(piece)
  }
  return custom.getAttachments().length > 0 ? custom : null
}
