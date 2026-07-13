import { AGENT_ROSTER } from '@/scene/layout/officeLayout'

/** Spine Chibi Stickers 可用皮肤（9 套，16 人会轮换复用） */
export const CHIBI_CHARACTER_SKINS = [
  'misaki',
  'erikari',
  'nate',
  'harri',
  'luke',
  'soeren',
  'mario',
  'sinisa',
  'spineboy',
] as const

const SKIN_BY_ID = new Map(
  AGENT_ROSTER.map((a, i) => [
    a.id,
    CHIBI_CHARACTER_SKINS[i % CHIBI_CHARACTER_SKINS.length],
  ]),
)

export function getChibiSkinName(agentId: string): string {
  return SKIN_BY_ID.get(agentId) ?? 'spineboy'
}
