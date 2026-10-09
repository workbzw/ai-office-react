// 流水线编排逻辑：阶段定义、运行单阶段

import { runPipelineStage, type Role, type Tenant, type Account } from './api'

export type PipelineStageId = 'topic' | 'script' | 'storyboard' | 'plan'

export const PIPELINE_STAGES: PipelineStageId[] = ['topic', 'script', 'storyboard', 'plan']

export const PIPELINE_STAGE_LABELS: Record<PipelineStageId, string> = {
  topic: '选题',
  script: '脚本',
  storyboard: '分镜',
  plan: '运营方案',
}

export type StageStatus = 'pending' | 'running' | 'done' | 'error'

export interface StageState {
  status: StageStatus
  output: any | null
  error: string
}

export interface PipelineState {
  active: boolean
  currentStage: PipelineStageId
  stages: Record<PipelineStageId, StageState>
}

export function createEmptyPipeline(): PipelineState {
  return {
    active: false,
    currentStage: 'topic',
    stages: {
      topic: { status: 'pending', output: null, error: '' },
      script: { status: 'pending', output: null, error: '' },
      storyboard: { status: 'pending', output: null, error: '' },
      plan: { status: 'pending', output: null, error: '' },
    },
  }
}

function getUpstreamInput(pipeline: PipelineState, stageId: PipelineStageId): string {
  const index = PIPELINE_STAGES.indexOf(stageId)
  if (index <= 0) return ''
  const prevStage = PIPELINE_STAGES[index - 1]
  const prevOutput = pipeline.stages[prevStage]?.output
  if (!prevOutput) return ''
  return JSON.stringify(prevOutput, null, 2)
}

export function canRunStage(pipeline: PipelineState, stageId: PipelineStageId): boolean {
  const index = PIPELINE_STAGES.indexOf(stageId)
  if (index <= 0) return true
  const prevStage = PIPELINE_STAGES[index - 1]
  const prevStatus = pipeline.stages[prevStage]?.status
  return prevStatus === 'done' || prevStatus === 'error'
}

export function getNextStage(stageId: PipelineStageId): PipelineStageId | null {
  const index = PIPELINE_STAGES.indexOf(stageId)
  if (index < 0 || index >= PIPELINE_STAGES.length - 1) return null
  return PIPELINE_STAGES[index + 1]
}

export async function runStage(options: {
  pipeline: PipelineState
  stageId: PipelineStageId
  userInput: string
  tenant: Tenant
  account: Account
  role: Role
  sessionMaterials?: string
  onUpdate: (pipeline: PipelineState) => void
}): Promise<{ success: boolean; error?: string }> {
  const { pipeline, stageId, userInput, tenant, account, role, sessionMaterials, onUpdate } = options

  pipeline.stages[stageId].status = 'running'
  pipeline.stages[stageId].error = ''
  onUpdate({ ...pipeline })

  try {
    const input = getUpstreamInput(pipeline, stageId)
    const result = await runPipelineStage({
      stage: stageId,
      input,
      userInput,
      tenant,
      account,
      role,
      sessionMaterials,
    })

    pipeline.stages[stageId].output = result.output || { rawText: result.rawText }
    pipeline.stages[stageId].status = 'done'
    onUpdate({ ...pipeline })
    return { success: true }
  } catch (error: any) {
    const friendlyError =
      error.name === 'AbortError'
        ? '生成超时，请重试。'
        : error.message === 'Failed to fetch'
          ? '网络连接失败，请检查网络后重试。'
          : error.message || '生成失败'
    pipeline.stages[stageId].status = 'error'
    pipeline.stages[stageId].error = friendlyError
    onUpdate({ ...pipeline })
    return { success: false, error: friendlyError }
  }
}
