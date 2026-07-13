import {
  IconExport,
  IconMeeting,
  IconPause,
  IconPlay,
  IconPlus,
  IconSchedule,
} from '@/components/icons'

const TOOLBAR_ITEMS = [
  { icon: IconPause, label: '全部暂停' },
  { icon: IconPlay, label: '全部继续' },
  { icon: IconSchedule, label: '任务调度' },
  { icon: IconMeeting, label: '安排会议' },
  { icon: IconPlus, label: '新建任务', primary: true },
  { icon: IconExport, label: '导出日报' },
] as const

export function OfficeBottomToolbar() {
  return (
    <div className="office-bottom-toolbar">
      <div className="toolbar-inner">
        {TOOLBAR_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.label}
              type="button"
              className={`toolbar-btn ${'primary' in item && item.primary ? 'primary' : ''}`}
            >
              <Icon className="toolbar-icon" />
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
