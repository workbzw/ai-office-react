import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 挂载后淡出 Marvis 风格初始加载器
function dismissInitialLoader() {
  const loader = document.getElementById('app-loader')
  if (!loader) return
  loader.classList.add('hide')
  // 等过渡完成再移除节点，避免残留拦截点击
  window.setTimeout(() => {
    loader.parentNode?.removeChild(loader)
  }, 600)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App onReady={dismissInitialLoader} />
  </StrictMode>,
)
