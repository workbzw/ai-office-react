import { Application, Container, Graphics, Sprite } from 'pixi.js'
import type { Agent } from '@/types/agent'
import {
  COLORS,
  DESKS,
  getOfficeViewportBounds,
  INITIAL_AGENTS,
  pickHandoffVisitMessage,
  SCENE_HEIGHT,
  SCENE_WIDTH,
} from '@/scene/layout/officeLayout'
import { AgentEntity } from '@/scene/entities/AgentEntity'
import { DeskEntity } from '@/scene/entities/DeskEntity'
import { MovementSystem } from '@/scene/systems/MovementSystem'
import { AnimationSystem } from '@/scene/systems/AnimationSystem'
import { ConversationSystem } from '@/scene/systems/ConversationSystem'
import { OfficeSimulator } from '@/scene/simulation/OfficeSimulator'
import { rosterAgentAt } from '@/scene/simulation/deskVisit'
import {
  MarketingWorkflowScheduler,
  type MarketingPath,
} from '@/scene/simulation/marketingWorkflow'
import type { OfficeTourRoute } from '@/scene/simulation/officeTourRoutes'
import { bindOfficeScene } from '@/scene/officeSceneBridge'
import { isDemoActionSource } from '@/config/officeMode'
import { notifyVisitMissionActivity } from '@/services/officeActionDispatcher'
import { useOfficeStore } from '@/store/officeStore'
import {
  getOfficeBackgroundTexture,
  loadOfficeAssets,
} from '@/scene/assets/loadOfficeAssets'
import { loadSpineAssets } from '@/scene/assets/loadSpineAssets'

export class OfficeScene {
  private app: Application | null = null
  private world: Container | null = null
  private agentEntities = new Map<string, AgentEntity>()
  private deskEntities = new Map<string, DeskEntity>()
  private officeLayer: Container | null = null

  private movement = new MovementSystem()
  private animation = new AnimationSystem()
  private conversation = new ConversationSystem()
  private simulator = new OfficeSimulator()

  private agents: Agent[] = INITIAL_AGENTS.map((a) => ({ ...a }))
  private destroyed = false
  private tourRoutes: OfficeTourRoute[] = []
  private tourRouteIndex = 0
  private watchingVisitorRosterNo: number | null = null
  private marketingWorkflow = new MarketingWorkflowScheduler()
  private useMarketingWorkflow = isDemoActionSource()

  async init(container: HTMLElement, width: number, height: number) {
    const app = new Application()
    await app.init({
      width,
      height,
      backgroundColor: COLORS.floor,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })

    this.app = app
    container.appendChild(app.canvas)

    this.world = new Container()
    app.stage.addChild(this.world)
    this.fitStage(width, height)

    await loadSpineAssets()
    const officeOk = await loadOfficeAssets()
    if (!officeOk) {
      console.error(
        '[Office] desk.png / chair.png 加载失败，工位将使用矢量占位图。请检查 public/assets/office/ 并硬刷新。',
      )
    }

    this.simulator.setAmbientFrozen(true)
    this.conversation.setEnabled(false)

    this.drawMap(this.world)
    this.spawnOffice(this.world)
    this.pushDataToEntities()

    app.ticker.add(this.onTick)
    this.startSimulationLoop()
    bindOfficeScene(this)

    if (isDemoActionSource()) {
      window.setTimeout(() => {
        if (!this.destroyed) this.startMarketingWorkflow('bid')
      }, 800)
    }
  }

  /** 市场部流程演示：标书线 / 市场情报线 */
  startMarketingWorkflow(path: MarketingPath = 'bid') {
    this.useMarketingWorkflow = true
    this.tourRoutes = []
    this.watchingVisitorRosterNo = null
    this.marketingWorkflow.start(path)
    const step = this.marketingWorkflow.currentStep()
    if (step) this.runMarketingStep(step)
  }

  /**
   * 按序自动播放拜访路线（路径测试用，会关闭市场部流程）。
   */
  startDemoTourSchedule(routes: OfficeTourRoute[]) {
    this.useMarketingWorkflow = false
    this.tourRoutes = [...routes]
    this.tourRouteIndex = 0
    this.watchingVisitorRosterNo = null
    this.startNextScheduledTour()
  }

  private runMarketingStep(step: {
    visitorRosterNo: number
    hostRosterNo: number
    message: string
  }) {
    this.watchingVisitorRosterNo = step.visitorRosterNo
    this.requestDeskVisit(
      step.visitorRosterNo,
      step.hostRosterNo,
      step.message,
    )
  }

  private startNextScheduledTour() {
    if (this.tourRouteIndex >= this.tourRoutes.length) return

    const route = this.tourRoutes[this.tourRouteIndex]!
    this.tourRouteIndex += 1
    this.watchingVisitorRosterNo = route.visitorRosterNo
    this.requestDeskVisitTour(route.visitorRosterNo, route.hostRosterNos)
  }

  private checkWorkflowAdvance() {
    if (this.watchingVisitorRosterNo == null) return

    const visitor = rosterAgentAt(this.agents, this.watchingVisitorRosterNo)
    if (visitor?.mission) return

    this.watchingVisitorRosterNo = null

    if (this.useMarketingWorkflow) {
      const next = this.marketingWorkflow.advanceAfterVisit()
      if (next) {
        this.runMarketingStep(next)
        return
      }
      window.setTimeout(() => {
        if (this.destroyed || !this.useMarketingWorkflow) return
        const first = this.marketingWorkflow.startNextRun()
        if (first) this.runMarketingStep(first)
      }, 2500)
      return
    }

    this.startNextScheduledTour()
  }

  /** 名册序号从 1 开始：visitor 去找 host 说一句话后回座继续工作 */
  requestDeskVisit(
    visitorRosterNo: number,
    hostRosterNo: number,
    message: string,
  ) {
    this.agents = this.simulator.startDeskVisit(
      this.agents,
      visitorRosterNo,
      hostRosterNo,
      message,
    )
    this.pushDataToEntities()
  }

  /** 按顺序拜访多个工位，全部说完后回访客工位 */
  requestDeskVisitTour(
    visitorRosterNo: number,
    hostRosterNos: number[],
    messageFn?: (hostRosterNo: number, hostName: string) => string,
  ) {
    this.agents = this.simulator.startDeskVisitTour(
      this.agents,
      visitorRosterNo,
      hostRosterNos,
      messageFn ?? ((hostNo, hostName) => pickHandoffVisitMessage(hostName, hostNo)),
    )
    this.pushDataToEntities()
  }

  resize(containerWidth: number, containerHeight: number) {
    if (!this.app || !this.world) return
    this.app.renderer.resize(containerWidth, containerHeight)
    this.fitStage(containerWidth, containerHeight)
  }

  /** 等比缩放工位内容区并居中，画布铺满容器不变形 */
  private fitStage(containerWidth: number, containerHeight: number) {
    if (!this.world) return

    const bounds = getOfficeViewportBounds()
    const scale = Math.min(
      containerWidth / bounds.width,
      containerHeight / bounds.height,
    )
    const offsetX =
      (containerWidth - bounds.width * scale) / 2 - bounds.x * scale
    const offsetY =
      (containerHeight - bounds.height * scale) / 2 - bounds.y * scale

    this.world.scale.set(scale)
    this.world.position.set(offsetX, offsetY)

    const canvas = this.app?.canvas as HTMLCanvasElement | undefined
    if (!canvas) return
    canvas.style.display = 'block'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.maxWidth = '100%'
    canvas.style.maxHeight = '100%'
  }

  destroy() {
    this.destroyed = true
    bindOfficeScene(null)
    this.app?.ticker.remove(this.onTick)
    this.app?.destroy(true, { children: true })
    this.app = null
    this.agentEntities.clear()
    this.deskEntities.clear()
    this.officeLayer = null
  }

  private onTick = (ticker: { deltaTime: number }) => {
    const dt = Math.min(ticker.deltaTime / 60, 0.05)

    this.agents = this.simulator.tick(dt, this.agents)
    this.pushDataToEntities()

    this.movement.update(this.agentEntities, dt)
    this.pullDataFromEntities()

    this.agents = this.simulator.afterMovement(
      dt,
      this.agents,
      this.agentEntities,
    )
    this.pushDataToEntities()
    this.checkWorkflowAdvance()

    const pair = this.conversation.tick(dt, this.agents)
    if (pair) {
      this.agents = this.simulator.startConversation(
        this.agents,
        pair.a,
        pair.b,
      )
      this.conversation.applyConversation(this.agentEntities, pair)
      this.pushDataToEntities()
    }

    this.animation.update(this.agentEntities, dt)
    this.sortOfficeDepth()
    this.syncDeskOccupancy()

    useOfficeStore.getState().setAgents(this.agents)
    useOfficeStore.getState().incrementTick()
    notifyVisitMissionActivity(this.agents)
  }

  private sortOfficeDepth() {
    if (!this.officeLayer) return

    const agentPositions = [...this.agentEntities.values()].map((e) => ({
      x: e.position.x,
      y: e.position.y,
    }))

    for (const e of this.agentEntities.values()) {
      e.zIndex = e.position.y
    }

    for (const desk of this.deskEntities.values()) {
      desk.updateDepthZ(agentPositions)
    }

    this.officeLayer.sortChildren()
  }

  private pushDataToEntities() {
    for (const agent of this.agents) {
      const entity = this.agentEntities.get(agent.id)
      if (!entity) continue

      const prev = entity.data
      entity.apply(agent)
      if (
        prev.x !== agent.x ||
        prev.y !== agent.y ||
        agent.state !== 'walking'
      ) {
        entity.setPosition(agent.x, agent.y)
      }
    }
  }

  private pullDataFromEntities() {
    this.agents = this.agents.map((agent) => {
      const entity = this.agentEntities.get(agent.id)
      return entity ? { ...agent, ...entity.data } : agent
    })
  }

  private syncDeskOccupancy() {
    const occupied = new Set(
      this.agents
        .filter((a) => a.state === 'working' && a.assignedDeskId)
        .map((a) => a.assignedDeskId!),
    )
    for (const desk of this.deskEntities.values()) {
      desk.setOccupied(occupied.has(desk.deskId))
    }
  }

  /** 桌子 / 人物 / 椅子同层；桌沿为界动态遮挡 */
  private spawnOffice(parent: Container) {
    const layer = new Container()
    layer.label = 'office'
    layer.sortableChildren = true
    this.officeLayer = layer

    for (const desk of DESKS) {
      const entity = new DeskEntity(desk)
      this.deskEntities.set(desk.id, entity)
      layer.addChild(
        entity.shadowGfx,
        entity.deskLayer,
        entity.chairLayer,
        entity.occupiedIndicator,
      )
    }

    for (const agent of this.agents) {
      const entity = new AgentEntity(agent)
      this.agentEntities.set(agent.id, entity)
      entity.zIndex = agent.y
      layer.addChild(entity)
    }

    this.sortOfficeDepth()
    parent.addChild(layer)
  }

  private drawMap(parent: Container) {
    const map = new Container()
    map.label = 'map'

    const floor = new Graphics()
    floor.rect(0, 0, SCENE_WIDTH, SCENE_HEIGHT)
    floor.fill(COLORS.floor)
    map.addChild(floor)

    const bgTex = getOfficeBackgroundTexture()
    if (bgTex) {
      const bg = new Sprite(bgTex)
      const scale = Math.max(
        SCENE_WIDTH / bgTex.width,
        SCENE_HEIGHT / bgTex.height,
      )
      bg.scale.set(scale)
      bg.position.set(
        (SCENE_WIDTH - bgTex.width * scale) / 2,
        (SCENE_HEIGHT - bgTex.height * scale) / 2,
      )
      map.addChild(bg)
    }

    parent.addChildAt(map, 0)
  }

  private startSimulationLoop() {
    const bump = () => {
      if (this.destroyed) return
      if (Math.random() > 0.6) {
        useOfficeStore.getState().bumpStats()
      }
      setTimeout(bump, 3000 + Math.random() * 2000)
    }
    bump()
  }
}
