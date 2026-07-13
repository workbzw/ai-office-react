import { Assets, type Texture } from 'pixi.js'

const BACKGROUND_URL = '/assets/office/office.png'
const DESK_URL = '/assets/office/desk.png'
const CHAIR_URL = '/assets/office/chair.png'

const BACKGROUND_ALIAS = 'office-background'
const DESK_ALIAS = 'office-desk'
const CHAIR_ALIAS = 'office-chair'

let backgroundTexture: Texture | null = null
let deskTexture: Texture | null = null
let chairTexture: Texture | null = null

export function getOfficeBackgroundTexture(): Texture | null {
  return backgroundTexture
}

export function getOfficeDeskTexture(): Texture | null {
  return deskTexture
}

export function getOfficeChairTexture(): Texture | null {
  return chairTexture
}

export function isOfficeAssetsReady(): boolean {
  return deskTexture != null && chairTexture != null
}

export async function loadOfficeAssets(): Promise<boolean> {
  let deskOk = false

  try {
    if (!Assets.resolver.hasKey(BACKGROUND_ALIAS)) {
      Assets.add({ alias: BACKGROUND_ALIAS, src: BACKGROUND_URL })
    }
    if (!Assets.resolver.hasKey(DESK_ALIAS)) {
      Assets.add({ alias: DESK_ALIAS, src: DESK_URL })
    }
    if (!Assets.resolver.hasKey(CHAIR_ALIAS)) {
      Assets.add({ alias: CHAIR_ALIAS, src: CHAIR_URL })
    }

    const bg = (await Assets.load(BACKGROUND_ALIAS)) as Texture
    if (bg?.source) {
      bg.source.scaleMode = 'linear'
      backgroundTexture = bg
    } else {
      backgroundTexture = null
    }
  } catch (err) {
    backgroundTexture = null
    console.warn('[Office] 办公室背景加载失败，将使用纯色底', err)
  }

  try {
    const desk = (await Assets.load(DESK_ALIAS)) as Texture
    const chair = (await Assets.load(CHAIR_ALIAS)) as Texture

    if (!desk?.source || !chair?.source) {
      throw new Error('桌椅纹理无效')
    }

    desk.source.scaleMode = 'linear'
    chair.source.scaleMode = 'linear'
    deskTexture = desk
    chairTexture = chair
    deskOk = true
    console.info('[Office] 工位桌椅素材已加载', {
      desk: `${desk.width}×${desk.height}`,
      chair: `${chair.width}×${chair.height}`,
    })
  } catch (err) {
    deskTexture = null
    chairTexture = null
    console.warn('[Office] 工位素材加载失败，将使用矢量回退', err)
  }

  if (backgroundTexture) {
    console.info('[Office] 办公室背景已加载', {
      background: `${backgroundTexture.width}×${backgroundTexture.height}`,
    })
  }

  return deskOk
}
