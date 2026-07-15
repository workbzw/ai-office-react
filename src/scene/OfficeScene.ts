import { Application, Container, Graphics, Sprite } from 'pixi.js'
import type { FederatedPointerEvent } from 'pixi.js'
import type { Agent, AgentState } from '@/types/agent'
import {
  AGENT_ROSTER,
  COLORS,
  DESKS,
  INITIAL_AGENTS,
  pickHandoffVisitMessage,
  SCENE_HEIGHT,
  SCENE_WIDTH,
} from '@/scene/layout/officeLayout'
import { AgentEntity } from '@/scene/entities/AgentEntity'
import { DeskEntity } from '@/scene/entities/DeskEntity'
import { MovementSystem } from '@/scene/systems/MovementSystem'
import { AnimationSystem } from '@/scene/systems/AnimationSystem'
import { OfficeSimulator } from '@/scene/simulation/OfficeSimulator'
import { bindOfficeScene } from '@/scene/officeSceneBridge'
import {
  hasPendingVisitQueue,
  notifyVisitMissionActivity,
} from '@/services/officeActionDispatcher'
import { setOfficeAgents } from '@/store/officeStore'
import {
  getOfficeBackgroundTexture,
  loadOfficeAssets,
} from '@/scene/assets/loadOfficeAssets'
import { loadSpineAssets } from '@/scene/assets/loadSpineAssets'

export type OfficeAgentClick = {
  agent: Agent
  rosterNo: number
  clientX: number
  clientY: number
}

type AutoWorkflowStep = {
  visitor: number
  host: number
  message: string
}

const AUTO_WORKFLOW_MAX_ACTIVE = 2
const AUTO_WORKFLOW_INTERVAL = 1.2

const AUTO_WORKFLOW_STEPS: AutoWorkflowStep[] = [
  { visitor: 1, host: 2, message: '新的任务来了，先帮我扫一下信息源。' },
  { visitor: 2, host: 3, message: '资料已经找到，麻烦整理一下。' },
  { visitor: 3, host: 4, message: '这份可以进入撰写了。' },
  { visitor: 4, host: 6, message: '初稿好了，请帮忙审一下。' },
  { visitor: 6, host: 4, message: '这里需要改一版，我标了重点。' },
  { visitor: 5, host: 1, message: '市场简报已经打包，请看一下。' },
  { visitor: 1, host: 5, message: '同步一下调研方向，准备发给团队。' },
  { visitor: 3, host: 6, message: '归档完成，合规队列可以接手。' },
  { visitor: 2, host: 5, message: '这些来源适合市场情报线。' },
  { visitor: 4, host: 1, message: '修改稿已完成，等你签批。' },
]

export class OfficeScene {
  private app: Application | null = null
  private world: Container | null = null
  private agentEntities = new Map<string, AgentEntity>()
  private deskEntities = new Map<string, DeskEntity>()
  private officeLayer: Container | null = null

  private movement = new MovementSystem()
  private animation = new AnimationSystem()
  private simulator = new OfficeSimulator()

  private agents: Agent[] = INITIAL_AGENTS.map((a) => ({ ...a }))
  private autoWorkflowTimer = 0.8
  private autoWorkflowIndex = 0
  private readonly options: {
    onAgentClick?: (event: OfficeAgentClick) => void
  }

  constructor(options: { onAgentClick?: (event: OfficeAgentClick) => void } = {}) {
    this.options = options
  }

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

    this.drawMap(this.world)
    this.spawnOffice(this.world)
    this.pushDataToEntities()

    app.ticker.add(this.onTick)
    bindOfficeScene(this)
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

  getAgents(): Agent[] {
    return this.agents.map((agent) => ({ ...agent }))
  }

  setAgentState(id: string, state: AgentState, task?: string) {
    this.agents = this.agents.map((agent) => {
      if (agent.id !== id) return agent
      return {
        ...agent,
        state,
        currentTask: task,
        targetX: undefined,
        targetY: undefined,
        walkPath: undefined,
        walkPathIndex: undefined,
        mission: undefined,
        bubbleText: undefined,
        customAnimation: undefined,
        viewFacing:
          state === 'working' || state === 'thinking'
            ? ('back' as const)
            : agent.viewFacing,
      }
    })
    setOfficeAgents(this.agents)
    this.pushDataToEntities()
  }

  playAgentAnimation(id: string, animation: string, task?: string) {
    this.agents = this.agents.map((agent) => {
      if (agent.id !== id) return agent
      return {
        ...agent,
        state: 'talking' as const,
        currentTask: task,
        targetX: undefined,
        targetY: undefined,
        walkPath: undefined,
        walkPathIndex: undefined,
        mission: undefined,
        bubbleText: undefined,
        customAnimation: animation,
        viewFacing: 'front' as const,
        facing: 1 as const,
      }
    })
    setOfficeAgents(this.agents)
    this.pushDataToEntities()
    this.agentEntities.get(id)?.playCustomAnimation(animation, task)
    this.pullDataFromEntities()
    setOfficeAgents(this.agents)
  }

  resize(containerWidth: number, containerHeight: number) {
    if (!this.app || !this.world) return
    this.app.renderer.resize(containerWidth, containerHeight)
    this.fitStage(containerWidth, containerHeight)
  }

  /** 等比缩放完整办公室场景并居中，任何屏幕比例下都不裁切内容 */
  private fitStage(containerWidth: number, containerHeight: number) {
    if (!this.world) return

    const scale = Math.min(
      containerWidth / SCENE_WIDTH,
      containerHeight / SCENE_HEIGHT,
    )
    const offsetX = (containerWidth - SCENE_WIDTH * scale) / 2
    const offsetY = (containerHeight - SCENE_HEIGHT * scale) / 2

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

    // 先同步 store 并消费外部队列，再补 Demo，避免空闲窗口被自动工作流吞掉
    setOfficeAgents(this.agents)
    notifyVisitMissionActivity(this.agents)
    this.updateAutoWorkflow(dt)

    this.animation.update(this.agentEntities, dt)
    this.sortOfficeDepth()
    this.syncDeskOccupancy()

    setOfficeAgents(this.agents)
  }

  private updateAutoWorkflow(dt: number) {
    this.autoWorkflowTimer -= dt
    if (this.autoWorkflowTimer > 0) return

    // 外部 HTTP 拜访优先：有待执行命令时不启动新的 Demo 拜访
    if (hasPendingVisitQueue()) {
      this.autoWorkflowTimer = 0.35
      return
    }

    const activeCount = this.agents.filter((agent) => agent.mission).length
    if (activeCount >= AUTO_WORKFLOW_MAX_ACTIVE) {
      this.autoWorkflowTimer = 0.35
      return
    }

    const step = this.nextAvailableWorkflowStep()
    if (!step) {
      this.autoWorkflowTimer = 0.45
      return
    }

    const visitorName = AGENT_ROSTER[step.visitor - 1]?.name ?? `#${step.visitor}`
    const message = `${visitorName}：${step.message}`
    this.agents = this.simulator.startDeskVisit(
      this.agents,
      step.visitor,
      step.host,
      message,
    )
    this.pushDataToEntities()
    this.autoWorkflowTimer = AUTO_WORKFLOW_INTERVAL
  }

  private nextAvailableWorkflowStep(): AutoWorkflowStep | null {
    for (let i = 0; i < AUTO_WORKFLOW_STEPS.length; i++) {
      const index = (this.autoWorkflowIndex + i) % AUTO_WORKFLOW_STEPS.length
      const step = AUTO_WORKFLOW_STEPS[index]!
      if (this.canStartWorkflowStep(step)) {
        this.autoWorkflowIndex = (index + 1) % AUTO_WORKFLOW_STEPS.length
        return step
      }
    }
    return null
  }

  private canStartWorkflowStep(step: AutoWorkflowStep): boolean {
    const visitor = this.agents[step.visitor - 1]
    const host = this.agents[step.host - 1]
    if (!visitor || !host || visitor.id === host.id) return false

    const busyIds = new Set<string>()
    for (const agent of this.agents) {
      if (agent.mission) {
        busyIds.add(agent.id)
        busyIds.add(agent.mission.hostAgentId)
      }
      if (agent.state === 'walking' || agent.customAnimation) {
        busyIds.add(agent.id)
      }
    }

    return !busyIds.has(visitor.id) && !busyIds.has(host.id)
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
      entity.on('pointertap', (event: FederatedPointerEvent) => {
        event.stopPropagation()
        this.options.onAgentClick?.({
          agent: { ...entity.data },
          rosterNo: this.agents.findIndex((a) => a.id === agent.id) + 1,
          clientX: event.clientX,
          clientY: event.clientY,
        })
      })
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
      const scale = Math.min(
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
}
