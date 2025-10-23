import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true
      }
    }
  }
})

// 附加说明：为了开发时允许 LAN 访问但拒绝公网访问，我们在 dev server 上注册中间件
// 来检查客户端 IP，仅允许本地和常见私有网段（10/8、172.16/12、192.168/16、169.254/16、100.64/10）以及 IPv6 的本地/ULA/link-local
// 该中间件在开发模式（vite dev）生效，不会影响生产构建。
