export type TaskCard = {
  id: string
  title: string
  assignee: string
  progress: number
  status: '进行中' | '等待开始'
  theme: 'blue' | 'orange' | 'purple' | 'green'
}

export type ActivityEntry = {
  id: string
  agent: string
  action: string
  time: string
}

export const TASK_CARDS: TaskCard[] = [
  {
    id: 'market-research',
    title: '市场调研',
    assignee: '李研',
    progress: 72,
    status: '进行中',
    theme: 'blue',
  },
  {
    id: 'copywriting',
    title: '文案撰写',
    assignee: '陈书',
    progress: 60,
    status: '进行中',
    theme: 'orange',
  },
  {
    id: 'compliance',
    title: '合规审核',
    assignee: '赵审',
    progress: 30,
    status: '进行中',
    theme: 'purple',
  },
  {
    id: 'packaging',
    title: '打包汇报',
    assignee: '刘市',
    progress: 0,
    status: '等待开始',
    theme: 'green',
  },
]

export const INITIAL_ACTIVITIES: ActivityEntry[] = [
  { id: '1', agent: '李研', action: '开始执行任务：市场调研', time: '14:26' },
  { id: '2', agent: '周理', action: '完成情报整理', time: '14:18' },
  { id: '3', agent: '陈书', action: '更新标书草稿', time: '14:05' },
  { id: '4', agent: '王明', action: '分配新任务', time: '13:52' },
  { id: '5', agent: '赵审', action: '加入审核队列', time: '13:40' },
]
