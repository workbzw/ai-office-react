# AI Office React

独立版 AI 办公室前端项目， Vite + React 应用直接运行，注意素材版权问题！

## 运行

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

## WebSocket 驱动

默认使用 demo 模式。如需接入外部 Agent 服务，可在 `.env.local` 中配置：

```bash
VITE_OFFICE_ACTION_SOURCE=websocket
VITE_OFFICE_WS_URL=ws://localhost:8787
VITE_OFFICE_DISPATCH_MODE=queue
```
