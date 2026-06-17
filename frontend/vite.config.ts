import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      // 【SSE 流式注意】Vite 开发服务器通过 http-proxy 把 /api 转发到
      // localhost:3001。虽然 http-proxy 支持流式转发，但某些版本/配置下
      // 会缓冲 SSE 响应，导致浏览器端不是逐字出现，而是等整段回答结束后
      // 才一次性收到。排查方法：
      //   1. 直接用 curl 请求 http://localhost:3001/api/chat/stream，
      //      若 curl 能逐字打印，则问题在 Vite 代理或浏览器端；
      //   2. 在浏览器 Network 面板查看 /api/chat/stream 的 Timing，
      //      看 TTFB 后是否陆续收到数据，还是等到最后才全部收到；
      //   3. 临时绕过代理：把前端 fetch('/api/chat/stream') 改成
      //      fetch('http://localhost:3001/api/chat/stream') 并配置 CORS。
      '/api': {
        // 使用 127.0.0.1 避免 Windows 下 localhost 解析到 IPv6 ::1
        // 而 Node 默认监听 IPv4/IPv6 不一致导致的连接问题
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
})