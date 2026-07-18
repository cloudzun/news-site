// @ts-check
import { defineConfig } from 'astro/config';

// 部署到 GitHub Pages 项目页时（形如 https://<user>.github.io/<repo>/），
// 需要设置 base 为 "/<repo>"。通过环境变量 BASE_PATH 传入，CI 里会自动设置。
// 本地开发或部署到自定义域名/用户主页（<user>.github.io）时可留空。
const base = process.env.BASE_PATH || '/';
const site = process.env.SITE_URL || 'http://localhost:4321';

export default defineConfig({
  site,
  base,
  outDir: './dist',
  build: {
    format: 'directory',
  },
});
