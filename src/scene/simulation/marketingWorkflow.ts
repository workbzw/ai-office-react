import { AGENT_ROSTER } from '@/scene/layout/officeLayout'

/** 市场部名册序号（与工位 1–6 对应） */
export const MARKETING_ROLES = {
  supervisor: 1,
  research: 2,
  organizer: 3,
  proposal: 4,
  marketIntel: 5,
  reviewer: 6,
} as const

export type MarketingPath = 'bid' | 'market'

const PATH_LABEL: Record<MarketingPath, string> = {
  bid: '标书线',
  market: '市场情报线',
}

export type MarketingWorkflowStep = {
  visitorRosterNo: number
  hostRosterNo: number
  message: string
  label: string
}

function rosterName(rosterNo: number): string {
  return AGENT_ROSTER[rosterNo - 1]?.name ?? `#${rosterNo}`
}

function step(
  visitorRosterNo: number,
  hostRosterNo: number,
  label: string,
  text: string,
): MarketingWorkflowStep {
  return {
    visitorRosterNo,
    hostRosterNo,
    label,
    message: `${rosterName(visitorRosterNo)}：${text}`,
  }
}

/** 共享前两步：主管派活 → 检索 → 通知整理 */
function sharedOpeningSteps(): MarketingWorkflowStep[] {
  return [
    step(
      1,
      2,
      '1→2 主管派活检索',
      '新的市场任务下来了，请扫描信息源并更新到团队频道。',
    ),
    step(
      2,
      3,
      '2→3 检索通知整理',
      '新消息和链接已汇总，请整理并分流情报。',
    ),
  ]
}

/** 标书线：整理 → 撰写 → 审核（驳回一次）→ 主管 */
export function buildBidWorkflowSteps(): MarketingWorkflowStep[] {
  return [
    ...sharedOpeningSteps(),
    step(
      3,
      4,
      '3→4 标书就绪 → 撰写',
      '这份资料可以写标书了，请起草方案。',
    ),
    step(
      4,
      6,
      '4→6 标书 → 审核',
      '标书初稿好了，请你审阅。',
    ),
    step(
      6,
      4,
      '6→4 审核驳回',
      '需要修改，详见文档批注。',
    ),
    step(
      4,
      6,
      '4→6 修改后重提',
      '修订稿已附上，请再审。',
    ),
    step(
      6,
      1,
      '6→1 审核通过 → 主管',
      '已通过，终稿请主管签批。',
    ),
  ]
}

/** 市场情报线：整理 → 市场专员 → 主管 */
export function buildMarketWorkflowSteps(): MarketingWorkflowStep[] {
  return [
    ...sharedOpeningSteps(),
    step(
      3,
      5,
      '3→5 一般情报 → 市场专员',
      '这是一般市场情报，请归档并分发。',
    ),
    step(
      5,
      1,
      '5→1 市场简报 → 主管',
      '市场情报简报已完成，请审阅。',
    ),
  ]
}

export class MarketingWorkflowScheduler {
  private steps: MarketingWorkflowStep[] = []
  private stepIndex = 0
  private path: MarketingPath = 'bid'
  private runAlternate = true

  /** 从标书流程开始；完成后可自动切换市场情报线 */
  start(path: MarketingPath = 'bid') {
    this.path = path
    this.stepIndex = 0
    this.steps =
      path === 'bid' ? buildBidWorkflowSteps() : buildMarketWorkflowSteps()
  }

  get activePath(): MarketingPath {
    return this.path
  }

  get progressLabel(): string {
    if (this.steps.length === 0) return '空闲'
    const step = this.steps[this.stepIndex]
    return step
      ? `${this.stepIndex + 1}/${this.steps.length} ${step.label}`
      : `已完成（${PATH_LABEL[this.path]}）`
  }

  /** 当前应执行的步骤；无则返回 null（本轮流程已结束） */
  currentStep(): MarketingWorkflowStep | null {
    return this.steps[this.stepIndex] ?? null
  }

  /** 访客 mission 结束后调用，返回下一步；若本轮结束则准备下一轮 */
  advanceAfterVisit(): MarketingWorkflowStep | null {
    this.stepIndex += 1
    if (this.stepIndex < this.steps.length) {
      return this.steps[this.stepIndex]!
    }
    return null
  }

  /** 本轮结束后切换路径并重新开始 */
  startNextRun(): MarketingWorkflowStep | null {
    if (this.runAlternate) {
      this.path = this.path === 'bid' ? 'market' : 'bid'
    }
    this.start(this.path)
    return this.currentStep()
  }
}
