import type { Agent, AgentState, Desk, Waypoint } from '@/types/agent'

export const SCENE_WIDTH = 960
export const SCENE_HEIGHT = 640

/** 办公室 AI 员工数量（与工位数一致） */
export const AGENT_COUNT = 6

export const COLORS = {
  floor: 0xffffff,
  wall: 0xe8e6e1,
  desk: 0xffffff,
  deskShadow: 0x00000014,
  monitor: 0x2a2a2a,
  chair: 0xd4d2cc,
  agentBody: 0x1a1a1a,
} as const

/** 2×3 工位区 */
const DESK_COLS = 2
const DESK_ROWS = 3
const DESK_COL_GAP = 150
const DESK_ROW_GAP = 140
const DESK_BLOCK_WIDTH = (DESK_COLS - 1) * DESK_COL_GAP
const DESK_BLOCK_HEIGHT = (DESK_ROWS - 1) * DESK_ROW_GAP
/** 工位阵列在场景内水平/垂直居中 */
const DESK_ORIGIN_X = (SCENE_WIDTH - DESK_BLOCK_WIDTH) / 2
const DESK_ORIGIN_Y = (SCENE_HEIGHT - DESK_BLOCK_HEIGHT) / 2
export const SEAT_OFFSET_Y = 45

/** 视口适配时围绕工位区的有效内容范围（避免宽屏下两侧留白失衡） */
const VIEWPORT_PAD_X = 200
const VIEWPORT_PAD_Y = 120

export function getOfficeViewportBounds() {
  return {
    x: DESK_ORIGIN_X - VIEWPORT_PAD_X,
    y: DESK_ORIGIN_Y - VIEWPORT_PAD_Y,
    width: DESK_BLOCK_WIDTH + VIEWPORT_PAD_X * 2,
    height: DESK_BLOCK_HEIGHT + VIEWPORT_PAD_Y * 2,
  }
}

function buildDesks(): Desk[] {
  const desks: Desk[] = []
  let n = 0
  for (let row = 0; row < DESK_ROWS; row++) {
    for (let col = 0; col < DESK_COLS; col++) {
      const x = DESK_ORIGIN_X + col * DESK_COL_GAP
      const y = DESK_ORIGIN_Y + row * DESK_ROW_GAP
      desks.push({
        id: `desk-${n}`,
        x,
        y,
        seatX: x,
        seatY: y + SEAT_OFFSET_Y,
      })
      n++
    }
  }
  return desks
}

export const DESKS: Desk[] = buildDesks()

/**
 * 修改 DESK_* 布局常量后调用，重建 DESKS 数组。
 * 寻路图会在下次走路时根据新坐标自动重建。
 */
export function syncOfficeLayout(): Desk[] {
  const next = buildDesks()
  DESKS.length = 0
  DESKS.push(...next)
  return DESKS
}

export const WAYPOINTS: Waypoint[] = DESKS.map((d) => ({
  id: d.id,
  label: d.id,
  x: d.seatX,
  y: d.seatY,
  kind: 'desk' as const,
}))

export type AgentRosterEntry = {
  id: string
  name: string
  color: number
  task: string
}

/** 6 位市场部员工（名册序号 1–6） */
export const AGENT_ROSTER: AgentRosterEntry[] = [
  {
    id: 'marvis',
    name: '王明',
    color: 0xe85d4a,
    task: '主管：等待交付物',
  },
  {
    id: 'code-agent',
    name: '李研',
    color: 0x4a90d9,
    task: '检索：扫描信息源',
  },
  {
    id: 'file-agent',
    name: '周理',
    color: 0x9b6dd7,
    task: '整理：归类情报',
  },
  {
    id: 'app-agent',
    name: '陈书',
    color: 0xf5c542,
    task: '撰写：起草标书',
  },
  {
    id: 'review-agent',
    name: '刘市',
    color: 0xf97316,
    task: '市场：打包情报简报',
  },
  {
    id: 'data-agent',
    name: '赵审',
    color: 0x4ecdc4,
    task: '审核：合规待审队列',
  },
]

const BOOT_STATES: AgentState[] = [
  'working',
  'working',
  'working',
  'working',
  'working',
  'working',
]

function buildInitialAgents(): Agent[] {
  return AGENT_ROSTER.map((entry, i) => {
    const desk = DESKS[i]
    const state = BOOT_STATES[i] ?? 'idle'
    return {
      id: entry.id,
      name: entry.name,
      color: entry.color,
      x: desk.seatX,
      y: desk.seatY,
      state,
      currentTask: state === 'idle' ? undefined : entry.task,
      assignedDeskId: desk.id,
      facing: i % 2 === 0 ? 1 : -1,
      viewFacing:
        state === 'working' || state === 'thinking' ? ('back' as const) : ('front' as const),
    }
  })
}

export const INITIAL_AGENTS: Agent[] = buildInitialAgents()

/** 交接流程中的状态标签（头顶 / 侧栏） */
export const HANDOFF_STATUS = {
  delivering: '交接递送中…',
  handingOff: '正在交接…',
  receiving: '接收交接中…',
  wrappingUp: '交接收尾中…',
  planning: '规划交接中…',
} as const

/** 工位上执行已接手的任务（市场部） */
export const ACTION_TASKS = [
  '扫描行业资讯…',
  '向频道发布更新…',
  '按主题整理来源…',
  '标注标书/市场情报…',
  '撰写标书章节…',
  '落实审核意见…',
  '打包市场简报…',
  '执行合规检查…',
  '转交下一负责人…',
  '等待主管签批…',
] as const

/** 路过闲聊：市场部交接对话 */
export const CHAT_HANDOFF_PAIRS: readonly [string, string][] = [
  [
    '主管安排了新一轮扫描，能接手一下信息流吗？',
    '没问题，标书相关的我会发到团队频道。',
  ],
  [
    '团队频道有新消息，可以开始整理了吗？',
    '收到，我会区分标书就绪和一般市场情报。',
  ],
  [
    '这份资料看起来可以写标书了，你能接手吗？',
    '好的，我起草完就送去审核。',
  ],
  [
    '这是一般市场笔记，请归档给团队。',
    '明白，整理完我会把简报交给主管。',
  ],
  [
    '标书初稿已在你的审核队列里。',
    '我会批注，需要修改的话会退回。',
  ],
  [
    '修改稿已提交，请再核对合规部分。',
    '正在审，通过的话我会转给主管。',
  ],
]

/** 离座拜访时交给对方的话术 */
export const HANDOFF_VISIT_MESSAGES: ((hostName: string) => string)[] = [
  (n) => `${n}，这件事交给你了。`,
  (n) => `${n}，轮到你了，说明在工单里。`,
  (n) => `${n}，接力给你，上下文在线程里。`,
  (n) => `${n}，你队列里有最新的交接包。`,
  (n) => `${n}，工单已转给你，我这边解除了阻塞。`,
  (n) => `${n}，能从这里接手吗？`,
  (n) => `${n}，我这边交接完成，交给你了。`,
  (n) => `${n}，收到后请确认一下。`,
]

export function pickHandoffVisitMessage(
  hostName: string,
  hostRosterNo: number,
): string {
  const i = Math.abs(hostRosterNo - 1) % HANDOFF_VISIT_MESSAGES.length
  return HANDOFF_VISIT_MESSAGES[i]!(hostName)
}
