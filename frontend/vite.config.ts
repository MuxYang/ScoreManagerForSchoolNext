import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Connect } from 'vite'

// IP 白名单检测函数
function isPrivateIp(ip: string | undefined) {
  if (!ip) return false;
  // 去掉 IPv6 前缀
  ip = ip.replace(/^::ffff:/, '');

  // IPv4 私有网段
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  // 172.16.0.0 - 172.31.255.255
  const m = ip.match(/^172\.(\d+)\./);
  if (m) {
    const second = Number(m[1]);
    if (second >= 16 && second <= 31) return true;
  }
  // Carrier-grade NAT (100.64.0.0/10)
  if (ip.startsWith('100.')) return true;
  // Link-local
  if (ip.startsWith('169.254.')) return true;
  // localhost
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return true;

  // IPv6 ULA (fc00::/7) and link-local fe80::/10
  if (ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80') || ip.startsWith('::1')) return true;

  return false;
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // 自定义插件：在 dev server 注入 IP 白名单中间件，拒绝公网访问
    {
      name: 'vite-plugin-lan-only',
      configureServer(server) {
        // 仅在开发模式注入
        server.middlewares.use((req: any, res: any, next: any) => {
          try {
            const remote = (req.socket && req.socket.remoteAddress) || req.ip || req.headers['x-forwarded-for'];
            const ip = Array.isArray(remote) ? remote[0] : (remote || '').toString();
            if (!isPrivateIp(ip)) {
              res.statusCode = 403;
              res.end('Access denied: public IPs are not allowed to access the dev server.');
              return;
            }
          } catch (e) {
            // 出错时保守策略：拒绝访问
            res.statusCode = 403;
            res.end('Access denied');
            return;
          }
          next();
        });
      }
    }
  ],
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
