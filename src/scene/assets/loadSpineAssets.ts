import '@esotericsoftware/spine-pixi-v8'
import { Assets } from 'pixi.js'

/** 优先 Spine 官方高质量示例：Chibi Stickers → Mix-and-Match → 简笔 office */
export type SpineCharacterPack = 'chibi-stickers' | 'mix-and-match' | 'office'

let loaded = false
let activePack: SpineCharacterPack | null = null
let skeletonAlias = ''
let atlasAlias = ''

const PACKS: { id: SpineCharacterPack; skeleton: string; atlas: string }[] = [
  {
    id: 'chibi-stickers',
    skeleton: '/assets/characters/chibi-stickers/chibi-stickers.json',
    atlas: '/assets/characters/chibi-stickers/chibi-stickers.atlas',
  },
  {
    id: 'mix-and-match',
    skeleton: '/assets/characters/mix-and-match/mix-and-match.json',
    atlas: '/assets/characters/mix-and-match/mix-and-match.atlas',
  },
  {
    id: 'office',
    skeleton: '/assets/characters/office/office.json',
    atlas: '/assets/characters/office/office.atlas',
  },
]

export async function loadSpineAssets(): Promise<boolean> {
  if (loaded) return true

  for (const pack of PACKS) {
    const sk = `${pack.id}-skeleton`
    const at = `${pack.id}-atlas`
    try {
      Assets.add({ alias: sk, src: pack.skeleton })
      Assets.add({ alias: at, src: pack.atlas })
      await Assets.load([sk, at])
      skeletonAlias = sk
      atlasAlias = at
      activePack = pack.id
      loaded = true
      console.info(`[Spine] 高质量角色包已加载: ${pack.id}`)
      return true
    } catch (err) {
      console.warn(`[Spine] 资源包 "${pack.id}" 加载失败:`, err)
    }
  }

  console.error('[Spine] 角色资源加载失败，将使用程序绘制')
  return false
}

export function isSpineReady(): boolean {
  return loaded
}

export function getSpineCharacterPack(): SpineCharacterPack | null {
  return activePack
}

export function getSpineSkeletonAlias(): string {
  return skeletonAlias
}

export function getSpineAtlasAlias(): string {
  return atlasAlias
}
