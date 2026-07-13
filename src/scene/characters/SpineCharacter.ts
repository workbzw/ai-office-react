import { Spine } from '@esotericsoftware/spine-pixi-v8'
import { Color, Container, Graphics } from 'pixi.js'
import type { AgentState } from '@/types/agent'
import {
  getSpineAtlasAlias,
  getSpineCharacterPack,
  getSpineSkeletonAlias,
  type SpineCharacterPack,
} from '@/scene/assets/loadSpineAssets'
import {
  type ChibiFacing,
  resolveChibiPresetAnim,
} from '@/scene/characters/chibiAgentPresets'
import { getChibiSkinName } from '@/scene/characters/chibiStickerSkins'
import { resolveMixAndMatchSkin } from '@/scene/characters/mixAndMatchSkins'

type AnimMap = Record<AgentState, string>

type PackConfig = {
  scale: number
  y: number
  shadow: { w: number; h: number; y: number }
  anim: AnimMap
  /** 左右用不同动画名，不用 scale 镜像 */
  directional?: boolean
  timeScale?: Partial<Record<AgentState, number>>
  badgeSlot?: string
  /** 方向性动画：按朝向选 left/right 键 */
  animLR?: Partial<Record<AgentState, { left: string; right: string }>>
}

/** 挂名字：chibi 用发顶附近骨骼，避免头骨中心导致名字在脸中间 */
const HEAD_BONE: Partial<Record<SpineCharacterPack, string>> = {
  'chibi-stickers': 'hair-front',
  'mix-and-match': 'head',
  office: 'head',
}

/**
 * 屏幕移动方向 → Spine 动画（Chibi 资源里 left/right 与屏幕左右相反）
 */
const CHIBI_DIR_ANIM: Record<
  'idle' | 'walking',
  Record<ChibiFacing, string>
> = {
  idle: {
    front: 'movement/idle-front',
    back: 'movement/idle-back',
    left: 'movement/idle-right',
    right: 'movement/idle-left',
  },
  walking: {
    front: 'movement/trot-front',
    back: 'movement/trot-back',
    left: 'movement/trot-right',
    right: 'movement/trot-left',
  },
}

const PACK_CONFIG: Record<SpineCharacterPack, PackConfig> = {
  'chibi-stickers': {
    scale: 0.3,
    y: 2,
    shadow: { w: 24, h: 7, y: 4 },
    directional: true,
    anim: {
      idle: 'movement/idle-front',
      walking: 'movement/trot-front',
      working: 'movement/idle-front',
      thinking: 'emotes/thinking',
      talking: 'emotes/wave',
    },
    animLR: {
      idle: { left: 'movement/idle-left', right: 'movement/idle-right' },
      walking: { left: 'movement/trot-left', right: 'movement/trot-right' },
      working: { left: 'movement/idle-left', right: 'movement/idle-right' },
    } satisfies Partial<Record<AgentState, { left: string; right: string }>>,
    timeScale: { thinking: 0.85, talking: 1.1 },
  },
  'mix-and-match': {
    scale: 0.26,
    y: 8,
    shadow: { w: 22, h: 6, y: 6 },
    anim: {
      idle: 'idle',
      walking: 'walk',
      working: 'aware',
      thinking: 'dress-up',
      talking: 'blink',
    },
    timeScale: { thinking: 0.7, talking: 1.4 },
  },
  office: {
    scale: 0.72,
    y: 18,
    shadow: { w: 16, h: 5, y: 20 },
    anim: {
      idle: 'idle',
      walking: 'walk',
      working: 'work',
      thinking: 'think',
      talking: 'talk',
    },
    timeScale: { thinking: 0.75, talking: 1.15 },
    badgeSlot: 'badge',
  },
}

export class SpineCharacter extends Container {
  private readonly agentId: string
  private readonly agentColor: number
  private spine: Spine | null = null
  private shadow: Graphics
  private currentAnim = ''
  private ready = false
  private pack: SpineCharacterPack | null = null
  private agentState: AgentState = 'idle'
  private facing: 1 | -1 = 1
  private viewFacing: ChibiFacing = 'front'

  constructor(agentId: string, agentColor: number) {
    super()
    this.agentId = agentId
    this.agentColor = agentColor
    this.shadow = new Graphics()
    this.addChild(this.shadow)
    this.createSpine()
  }

  get isReady() {
    return this.ready
  }

  setAgentColor(color: number) {
    if (!this.spine) return
    const cfg = this.pack ? PACK_CONFIG[this.pack] : null

    if (cfg?.badgeSlot) {
      const slot = this.spine.skeleton.findSlot(cfg.badgeSlot)
      if (slot) {
        const c = new Color(color)
        slot.color.set(c.red, c.green, c.blue, 1)
      }
      return
    }

    // 官方 Chibi / Mix-and-Match：保持原画肤色与服装，不整身染色
    if (this.pack === 'chibi-stickers' || this.pack === 'mix-and-match') {
      this.spine.skeleton.color.set(1, 1, 1, 1)
      return
    }

    const c = new Color(color)
    this.spine.skeleton.color.set(c.red, c.green, c.blue, 0.92)
  }

  setFacing(dir: 1 | -1) {
    if (!this.spine || !this.pack) return
    const cfg = PACK_CONFIG[this.pack]
    this.facing = dir

    if (cfg.directional) {
      return
    }

    const base = Math.abs(this.spine.scale.x) || cfg.scale
    this.spine.scale.x = base * dir
  }

  setViewFacing(facing: ChibiFacing) {
    if (!this.spine || !this.pack) return
    const changed = this.viewFacing !== facing
    this.viewFacing = facing
    const cfg = PACK_CONFIG[this.pack]
    if (!cfg.directional) return
    if (changed) this.currentAnim = ''
    this.applyAnimation()
  }

  playState(state: AgentState) {
    if (!this.spine || !this.ready || !this.pack) return
    this.agentState = state
    this.applyAnimation()
  }

  getHeadOffsetY(): number {
    if (!this.spine || !this.pack) return -52

    const sy = Math.abs(this.spine.scale.y)
    const gap = 5

    // Chibi：只跟头骨走，固定抬到发顶；不用包围盒（剑/帽檐会把点拉偏）
    if (this.pack === 'chibi-stickers') {
      const head = this.spine.skeleton.findBone('head-base')
      if (!head) return this.spine.y - 84
      const headCenter = this.spine.y + head.worldY * sy
      if (headCenter > this.spine.y + 2) {
        return this.spine.y - 84
      }
      return headCenter - 50 * sy - 6
    }

    const candidates: number[] = []
    const boneName = HEAD_BONE[this.pack]
    if (boneName) {
      const bone = this.spine.skeleton.findBone(boneName)
      if (bone) {
        const lift = this.pack === 'mix-and-match' ? 18 : 10
        candidates.push(this.spine.y + bone.worldY * sy - lift - gap)
      }
    }

    const local = this.spine.getLocalBounds()
    if (local.height > 4) {
      const crownY = local.y + local.height * 0.08
      candidates.push(this.spine.y + crownY - gap)
    }

    // Pixi Y 向下为正：取较大值 = 更靠近角色，避免飘到场景顶部
    if (candidates.length > 0) {
      return Math.max(...candidates)
    }

    return -58
  }

  private resolveAnimationName(): string {
    if (!this.pack) return 'idle'

    if (this.pack === 'chibi-stickers') {
      if (this.agentState === 'walking') {
        return CHIBI_DIR_ANIM.walking[this.viewFacing]
      }
      // 工位 idle / work / think：按四向坐姿，归位 back = 背对镜头
      if (
        this.agentState === 'idle' ||
        this.agentState === 'working' ||
        this.agentState === 'thinking'
      ) {
        return CHIBI_DIR_ANIM.idle[this.viewFacing]
      }
      if (
        this.agentState === 'talking' &&
        (this.viewFacing === 'left' || this.viewFacing === 'right')
      ) {
        return CHIBI_DIR_ANIM.idle[this.viewFacing]
      }
      const presetAnim = resolveChibiPresetAnim(this.agentId, this.agentState)
      if (presetAnim) return presetAnim
    }

    const cfg = PACK_CONFIG[this.pack]
    const lr = cfg.animLR?.[this.agentState]
    if (cfg.directional && lr) {
      return this.facing >= 0 ? lr.right : lr.left
    }
    return cfg.anim[this.agentState] ?? cfg.anim.idle
  }

  private applyAnimation() {
    if (!this.spine || !this.pack) return

    const cfg = PACK_CONFIG[this.pack]
    const animName = this.resolveAnimationName()

    if (cfg.directional) {
      const base = cfg.scale
      this.spine.scale.x = base
      this.spine.scale.y = base
    }

    const walkKey =
      this.pack === 'chibi-stickers' && this.agentState === 'walking'
        ? `${animName}@${this.viewFacing}`
        : animName
    if (walkKey === this.currentAnim) {
      this.spine.state.timeScale = cfg.timeScale?.[this.agentState] ?? 1
      return
    }

    if (!this.spine.skeleton.data.findAnimation(animName)) {
      const fallback = cfg.anim.idle
      this.spine.state.setAnimation(0, fallback, true)
      this.currentAnim = fallback
      return
    }

    this.currentAnim = walkKey
    const entry = this.spine.state.setAnimation(0, animName, true)
    this.spine.state.timeScale = cfg.timeScale?.[this.agentState] ?? 1
    if (entry) entry.mixDuration = 0.22
  }

  private createSpine() {
    const pack = getSpineCharacterPack()
    if (!pack) return
    this.pack = pack

    try {
      const cfg = PACK_CONFIG[pack]
      const spine = Spine.from({
        skeleton: getSpineSkeletonAlias(),
        atlas: getSpineAtlasAlias(),
        scale: cfg.scale,
        autoUpdate: true,
      })

      if (pack === 'chibi-stickers') {
        const skinName = getChibiSkinName(this.agentId)
        if (spine.skeleton.data.findSkin(skinName)) {
          spine.skeleton.setSkinByName(skinName)
          spine.skeleton.setSlotsToSetupPose()
        }
      } else if (pack === 'mix-and-match') {
        const skin = resolveMixAndMatchSkin(spine.skeleton.data, this.agentId)
        if (skin) {
          spine.skeleton.setSkin(skin)
          spine.skeleton.setSlotsToSetupPose()
        }
      }

      spine.state.data.defaultMix = 0.22
      spine.position.set(0, cfg.y)
      this.spine = spine
      this.ready = true
      this.addChild(spine)
      this.drawShadow(cfg.shadow)
      this.setAgentColor(this.agentColor)
      this.applyAnimation()
    } catch (err) {
      console.error(`[SpineCharacter] 角色创建失败 (${pack}):`, err)
      this.ready = false
    }
  }

  private drawShadow(shadow: { w: number; h: number; y: number }) {
    this.shadow.clear()
    this.shadow.ellipse(0, shadow.y, shadow.w, shadow.h)
    this.shadow.fill({ color: 0x000000, alpha: 0.12 })
  }
}
