/** 演示用串联拜访路线（名册序号从 1 开始） */
export type OfficeTourRoute = {
  visitorRosterNo: number
  hostRosterNos: number[]
  /** 可选：测试用例说明，便于对照观察 */
  label?: string
}

/**
 * 工位布局（2×3，名册 = 索引 + 1）
 *
 *        左列    右列
 *  前排    1       2
 *  中排    3       4
 *  后排    5       6
 */

/** 日常演示（短路线） */
export const DEMO_OFFICE_TOUR_ROUTES: OfficeTourRoute[] = [
  { visitorRosterNo: 4, hostRosterNos: [3], label: '同排邻座·右访左' },
  { visitorRosterNo: 1, hostRosterNos: [5], label: '同列下行·左列' },
  { visitorRosterNo: 6, hostRosterNos: [2], label: '对角·右下→右上' },
  { visitorRosterNo: 3, hostRosterNos: [5], label: '跨行·中左→后左' },
  { visitorRosterNo: 2, hostRosterNos: [6], label: '跨行·前右→后右' },
]

/**
 * 路径行走全量测试（启动后按序自动播放，每条：离座 → 拜访 → 回座）
 *
 * | 类别           | 路线        | 验证要点                          |
 * |----------------|-------------|-----------------------------------|
 * | 同排邻座       | 4→3, 3→4    | 横向离座/回座，不绕外侧过道       |
 * | 同排非邻       | 1→2, 2→1    | 前排同行横向                      |
 * | 同列相邻行     | 1→3, 3→1    | 左列纵向 1 格                     |
 * | 同列相邻行     | 2→4, 4→2    | 右列纵向 1 格                     |
 * | 同列跨两行     | 1→5, 5→1    | 左列纵向 2 格                     |
 * | 同列跨两行     | 2→6, 6→2    | 右列纵向 2 格                     |
 * | 对角最远       | 1→6, 6→1    | 左上↔右下，长路径 + 过道          |
 * | 跨行跨列       | 1→4, 4→1    | 中列斜向                          |
 * | 跨行跨列       | 2→5, 5→2    | 左列↔右列不同行                   |
 * | 跨行跨列       | 3→6, 6→3    | 中排↔后排对角                     |
 * | 串联两站       | 1→[2,3]     | 一次离座连续拜访后回座            |
 */
export const OFFICE_PATH_TEST_ROUTES: OfficeTourRoute[] = [
  // —— 同排邻座（最关键：不应先上后下、不应绕远）——
  { visitorRosterNo: 4, hostRosterNos: [3], label: 'T01 同排邻座 右→左' },
  { visitorRosterNo: 3, hostRosterNos: [4], label: 'T02 同排邻座 左→右' },

  // —— 同排非邻（前排）——
  { visitorRosterNo: 1, hostRosterNos: [2], label: 'T03 前排同行 左→右' },
  { visitorRosterNo: 2, hostRosterNos: [1], label: 'T04 前排同行 右→左' },

  // —— 同列 · 相邻行 ——
  { visitorRosterNo: 1, hostRosterNos: [3], label: 'T05 左列下行 1 格' },
  { visitorRosterNo: 3, hostRosterNos: [1], label: 'T06 左列上行 1 格' },
  { visitorRosterNo: 2, hostRosterNos: [4], label: 'T07 右列下行 1 格' },
  { visitorRosterNo: 4, hostRosterNos: [2], label: 'T08 右列上行 1 格' },

  // —— 同列 · 跨两行 ——
  { visitorRosterNo: 1, hostRosterNos: [5], label: 'T09 左列下行 2 格' },
  { visitorRosterNo: 5, hostRosterNos: [1], label: 'T10 左列上行 2 格' },
  { visitorRosterNo: 2, hostRosterNos: [6], label: 'T11 右列下行 2 格' },
  { visitorRosterNo: 6, hostRosterNos: [2], label: 'T12 右列上行 2 格' },

  // —— 对角最远 ——
  { visitorRosterNo: 1, hostRosterNos: [6], label: 'T13 对角 1→6' },
  { visitorRosterNo: 6, hostRosterNos: [1], label: 'T14 对角 6→1' },

  // —— 跨行跨列 ——
  { visitorRosterNo: 1, hostRosterNos: [4], label: 'T15 斜向 1→4' },
  { visitorRosterNo: 4, hostRosterNos: [1], label: 'T16 斜向 4→1' },
  { visitorRosterNo: 2, hostRosterNos: [5], label: 'T17 斜向 2→5' },
  { visitorRosterNo: 5, hostRosterNos: [2], label: 'T18 斜向 5→2' },
  { visitorRosterNo: 3, hostRosterNos: [6], label: 'T19 斜向 3→6' },
  { visitorRosterNo: 6, hostRosterNos: [3], label: 'T20 斜向 6→3' },

  // —— 串联拜访（离座一次、连访两站、再回座）——
  {
    visitorRosterNo: 1,
    hostRosterNos: [2, 3],
    label: 'T21 串联 1→2→3',
  },
]

/** 默认自动播放：全量路径测试 */
export const DEFAULT_OFFICE_TOUR_ROUTES: OfficeTourRoute[] =
  OFFICE_PATH_TEST_ROUTES
