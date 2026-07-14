# AI Office React

独立版 AI 办公室前端项目， Vite + React 应用直接运行

注意素材版权问题！

点击小人会有菜单弹出




## 运行

```bash
npm install
npm run dev
```

默认使用 HTTP 驱动员工动作。`npm run dev` 会同时启动：

- Vite 前端
- HTTP Action Gateway

默认动作入口为：

```bash
http://localhost:8765/actions
```

外部系统向该地址 `POST` 动作，前端会通过 HTTP 轮询取走并执行。

如需指定前端轮询地址：

```bash
VITE_OFFICE_HTTP_ACTIONS_URL=http://localhost:8765/actions npm run dev
```

如需单独启动动作网关：

```bash
npm run action-gateway
```

如需修改动作网关端口：

```bash
OFFICE_ACTION_GATEWAY_PORT=8766 npm run action-gateway
```

## HTTP 消息

单次工位拜访：

```bash
curl -X POST http://localhost:8765/actions \
  -H 'Content-Type: application/json' \
  -d '{"type":"desk_visit","visitor":1,"host":5,"message":"这件事交给你了。"}'
```

消息体示例：

```json
{
  "type": "desk_visit",
  "visitor": 1,
  "host": 5,
  "message": "这件事交给你了。"
}
```

连续拜访多个工位：

```json
{
  "type": "desk_visit_tour",
  "visitor": 1,
  "hosts": [2, 3, 4],
  "message": "请接手下一步。"
}
```

设置员工状态：

```json
{
  "type": "set_state",
  "rosterNo": 1,
  "state": "working",
  "task": "整理市场情报…"
}
```

## 联系我

如需交流或合作，可以扫码

<img src="./docs/wechat-qr.png" alt="微信二维码" width="220" />
