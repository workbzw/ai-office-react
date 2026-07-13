import { Container, Graphics } from 'pixi.js'
import type { Agent, AgentState } from '@/types/agent'
import {
  resolveWalkViewFacing,
  viewFacingToLR,
} from '@/scene/systems/movementFacing'
import { SpineCharacter } from '@/scene/characters/SpineCharacter'
import { isSpineReady } from '@/scene/assets/loadSpineAssets'
import { Bubble } from '@/scene/ui/Bubble'
import { StatusLabel } from '@/scene/ui/StatusLabel'

export class AgentEntity extends Container {
  readonly agentId: string
  private agent: Agent
  private spineChar: SpineCharacter | null = null
  private fallbackBody: Graphics | null = null
  private fallbackScarf: Graphics | null = null
  private statusLabel: StatusLabel
  private bubble: Bubble
  private walkPhase = 0
  private useSpine = false

  constructor(agent: Agent) {
    super()
    this.agentId = agent.id
    this.agent = { ...agent }

    this.statusLabel = new StatusLabel(agent.name)
    this.bubble = new Bubble()

    if (isSpineReady()) {
      this.spineChar = new SpineCharacter(agent.id, agent.color)
      if (this.spineChar.isReady) {
        this.useSpine = true
        this.spineChar.setAgentColor(agent.color)
        this.spineChar.setFacing(agent.facing)
        this.spineChar.setViewFacing(agent.viewFacing ?? 'front')
        this.spineChar.playState(agent.state)
        this.addChild(this.spineChar, this.statusLabel, this.bubble)
      } else {
        this.spineChar.destroy()
        this.spineChar = null
        this.initFallbackGraphics()
      }
    } else {
      this.initFallbackGraphics()
    }

    this.syncVisual()
    this.position.set(agent.x, agent.y)
  }

  get data(): Agent {
    return this.agent
  }

  apply(patch: Partial<Agent>) {
    const prevState = this.agent.state
    const prevFacing = this.agent.facing
    const prevViewFacing = this.agent.viewFacing
    const prevColor = this.agent.color
    this.agent = { ...this.agent, ...patch }

    if (this.useSpine && this.spineChar) {
      if (patch.viewFacing != null && patch.viewFacing !== prevViewFacing) {
        this.spineChar.setViewFacing(patch.viewFacing)
      }
      if (patch.facing != null && patch.facing !== prevFacing) {
        this.spineChar.setFacing(patch.facing)
      }
      if (patch.state != null && patch.state !== prevState) {
        this.spineChar.playState(patch.state)
      }
      if (patch.color != null && patch.color !== prevColor) {
        this.spineChar.setAgentColor(patch.color)
      }
      this.updateOverlayPositions()
    } else {
      this.syncVisual()
    }
  }

  setPosition(x: number, y: number) {
    this.agent.x = x
    this.agent.y = y
    this.position.set(x, y)
  }

  showBubble(text: string, duration = 4) {
    this.agent.bubbleText = text
    this.bubble.show(text, duration)
    this.updateOverlayPositions()
  }

  hideBubble() {
    this.agent.bubbleText = undefined
    this.bubble.hide()
  }

  updateVisuals(state: AgentState, dt: number) {
    if (this.useSpine && this.spineChar) {
      if (
        state === 'walking' &&
        this.agent.targetX != null &&
        this.agent.targetY != null
      ) {
        const viewFacing = resolveWalkViewFacing(
          this.agent.targetX - this.agent.x,
          this.agent.targetY - this.agent.y,
        )
        this.agent.viewFacing = viewFacing
        this.agent.facing = viewFacingToLR(viewFacing)
        this.spineChar.setViewFacing(viewFacing)
        this.spineChar.setFacing(this.agent.facing)
      } else if (state === 'working' || state === 'thinking') {
        if (this.agent.viewFacing !== 'back') {
          this.agent.viewFacing = 'back'
          this.spineChar.setViewFacing('back')
        }
      }
      this.spineChar.playState(state)
    } else {
      this.walkPhase += dt * 8
      this.drawFallbackBody(state, 0)
    }

    this.bubble.update(dt)
    this.statusLabel.setState(state)
    this.statusLabel.setTask(
      state === 'working' || state === 'thinking' ? this.agent.currentTask : undefined,
    )
    this.updateOverlayPositions()
  }

  private updateOverlayPositions() {
    const crownTopY = this.useSpine && this.spineChar
      ? this.spineChar.getHeadOffsetY()
      : -58
    this.statusLabel.layout(crownTopY)
    const labelTopY = this.statusLabel.getLabelTopY(crownTopY)
    const gapAboveLabel = 4
    const bubbleExtraDown = 10
    this.bubble.position.set(
      0,
      labelTopY - gapAboveLabel - Bubble.TAIL_TIP_Y + bubbleExtraDown,
    )
  }

  private syncVisual() {
    this.statusLabel.setName(this.agent.name)
    this.statusLabel.setState(this.agent.state)
    this.statusLabel.setTask(
      this.agent.state === 'working' || this.agent.state === 'thinking'
        ? this.agent.currentTask
        : undefined,
    )
    if (this.agent.bubbleText) {
      this.bubble.show(this.agent.bubbleText)
    }
    if (this.useSpine && this.spineChar) {
      this.spineChar.playState(this.agent.state)
      this.spineChar.setFacing(this.agent.facing)
      this.spineChar.setViewFacing(this.agent.viewFacing ?? 'front')
      this.spineChar.setAgentColor(this.agent.color)
    } else {
      this.drawFallbackBody(this.agent.state, 0)
    }
    this.updateOverlayPositions()
  }

  private initFallbackGraphics() {
    this.fallbackBody = new Graphics()
    this.fallbackScarf = new Graphics()
    this.addChild(this.fallbackBody, this.fallbackScarf, this.statusLabel, this.bubble)
    this.useSpine = false
  }

  private drawFallbackBody(state: AgentState, bob: number) {
    if (!this.fallbackBody || !this.fallbackScarf) return

    const facing = this.agent.facing
    const g = this.fallbackBody
    const s = this.fallbackScarf
    g.clear()
    s.clear()

    const bounce =
      state === 'walking'
        ? Math.sin(this.walkPhase) * 2
        : state === 'working'
          ? Math.sin(this.walkPhase * 2) * 1
          : bob

    // shadow
    g.ellipse(0, 16 + bounce, 14, 4)
    g.fill({ color: 0x000000, alpha: 0.1 })

    // legs / pants
    const legSwing = state === 'walking' ? Math.sin(this.walkPhase) * 3 : 0
    g.roundRect(-9, 6 + bounce + legSwing, 7, 12, 2)
    g.fill(0x3a3f4a)
    g.roundRect(2, 6 + bounce - legSwing, 7, 12, 2)
    g.fill(0x3a3f4a)

    // shirt body
    g.roundRect(-11, -8 + bounce, 22, 18, 4)
    g.fill(0xf8f8f6)
    g.roundRect(-7, -8 + bounce, 14, 4, 2)
    g.fill(0xe8e8e6)

    // head
    g.circle(facing * 1, -20 + bounce, 10)
    g.fill(0xffe0c4)
    g.roundRect(facing * 1 - 10, -28 + bounce, 20, 8, 3)
    g.fill(0x2a2a30)

    // typing arm when working
    if (state === 'working') {
      const armY = -4 + bounce + Math.sin(this.walkPhase * 3) * 2
      g.roundRect(facing * 12, armY, 8, 4, 2)
      g.fill(0xf8f8f6)
    }

    // thinking dots
    if (state === 'thinking') {
      for (let i = 0; i < 3; i++) {
        g.circle(14 + i * 6, -34 + bounce, 2)
        g.fill({ color: 0x9b6dd7, alpha: i <= Math.floor(this.walkPhase) % 3 ? 1 : 0.3 })
      }
    }

    // badge / 工牌
    s.roundRect(facing * 4 - 5, -2 + bounce, 10, 8, 2)
    s.fill(this.agent.color)

    this.scale.x = facing
  }
}
