# 科技新闻速览（自动聚合站）

一个几乎零维护的科技/IT + 相关财经新闻聚合站：
- 免费公开 RSS 源（无需注册/无需 API Key）
- GitHub Actions 每小时自动抓取、清洗、去重
- **每天一页**：首页直出当天新闻（按小时分组），最近 7 天 Tab 导航，超过 7 天不再展示
- 移动端优化（吸顶导航、触控适配、刘海屏安全区）
- Astro 静态生成，部署到 GitHub Pages（也可迁移 Vercel）
- 可选容器化：单容器自更新 + Docker Hub 自动构建推送

详细调研与方案见 [`docs/research_and_plan.md`](docs/research_and_plan.md)。
从零复刻教程（Coding Agent 驱动）见 [`TUTORIAL.md`](TUTORIAL.md)。

## 目录结构

```
scripts/            # 抓取脚本
  sources.yaml       # RSS 源配置（增删源在这里改）
  fetch_news.py       # 抓取 -> 清洗 -> 去重 -> 输出 data/
  requirements.txt
data/
  latest.json         # 最新聚合数据（Astro 构建时读取）
  archive/YYYY-MM-DD.json  # 每日归档（只保留最近 7 天）
site/                # Astro 静态站点
  src/pages/          # 首页 + day/[date] 每日新闻页
  src/components/     # NewsCard / DayTabs
  src/layouts/        # BaseLayout（吸顶导航、明暗配色）
  src/lib/data.ts     # 读取 data/latest.json、按天分组工具
.github/workflows/
  fetch-and-deploy.yml   # 定时抓取 + 构建 + 部署 GitHub Pages
  docker-image.yml       # push 后自动构建 Docker 镜像并推送 Docker Hub
Dockerfile / docker/      # 单容器自更新方案（抓取+构建+nginx）
docker-compose.yml        # 一键容器部署
```

## 页面组织

- **首页**：直接展示当天全部新闻（按小时分组 + 相对时间），顶部 7 天 Tab 导航，底部附最近 7 天链接
- 每日新闻页 `/day/YYYY-MM-DD/` 展示当天的全部新闻
- 超过 7 天的新闻不生成页面、不展示；抓取脚本也只保留最近 7 天的数据与归档

## 数据与更新机制

- 每小时自动抓取（GitHub Actions cron 或容器内置循环，均在整点后第 5 分钟）
- 新条目只入库**北京时间当天**发布的（`new_items_today_only`），避免 RSS 源回推的历史
  条目混入；历史数据靠 `latest.json` 在 7 天窗口内逐日积累
- 归档按天保存，只保留最近 7 天，更早文件自动清理

## 本地开发

```bash
# 1. 抓取新闻数据
cd scripts
py -m venv ../.venv        # 或 python3 -m venv ../.venv
../.venv/Scripts/pip install -r requirements.txt   # Windows
# ../.venv/bin/pip install -r requirements.txt     # macOS/Linux
../.venv/Scripts/python fetch_news.py

# 2. 本地预览站点
cd ../site
npm install
npm run dev
```

## 部署到 GitHub Pages

1. 仓库 Settings → Pages → Source 选择 "GitHub Actions"
2. push 到 main 分支后，Actions 会自动：抓取新闻 → commit 数据 → 构建 Astro → 部署 Pages
3. 也会按每小时 cron 自动跑一次，实现"免维护自动更新"

> ⚠️ 功能提交的 commit message 不要带 `[skip ci]`，否则会跳过构建部署
> （该标记只用于机器人自动提交数据）。

## 迁移/追加部署到 Vercel（可选）

`site/vercel.json` 已配置好构建参数。在 Vercel 后台 Import 这个仓库，
Root Directory 选 `site/`，其余保持默认即可。数据更新仍然由 GitHub Actions 的
定时任务负责抓取和 commit，Vercel 只需要在 `data/latest.json` 变化后重新构建
（可在 Vercel 项目里开启 "Git push 自动部署"）。

## 容器化部署（自托管，可选）

仓库根目录提供单容器方案：一个容器内同时包含 RSS 抓取、Astro 构建和 nginx
托管。启动时抓取**当天**新闻并构建，之后每小时第 5 分钟自动抓取重建页面
（与 GitHub Actions cron 节奏一致），无需依赖 GitHub。

```bash
docker build -t news-site .
docker run -d -p 8080:80 -v news-data:/app/data --name news-site news-site
# 访问 http://<主机>:8080/
```

或使用 docker compose：

```bash
docker compose up -d --build
```

`data/` 通过 volume 挂载持久化（7 天数据，重启不丢）。对外提供服务时建议
在前面加 Caddy/nginx 反代并配置 HTTPS。

镜像**不内置任何历史新闻数据**：仓库里的 `data/` 不会打进镜像，容器首次
启动时自己抓取当天新闻并开始积累，之后每小时自动更新。

### Docker Hub 自动构建

仓库内置 `docker-image.yml` 工作流：push 后自动构建镜像（未配置凭据时只构建不
推送，保证 CI 不红）。在仓库 Settings → Secrets → Actions 配置两个 secret 后，
会自动推送 `latest` 与 commit sha 两个 tag 到 Docker Hub：

- `DOCKERHUB_USERNAME`：Docker Hub 用户名
- `DOCKERHUB_TOKEN`：Docker Hub 访问令牌（Account Settings → Personal access tokens）

## 完整复刻教程

面向"有 Coding Agent、不想手写代码"的学习者：从 PRD 开始，逐步完成搭建 →
改版 → 美化 → GitHub Pages 部署 → 容器化 → Docker Hub 发布，全程提示词驱动，
每个阶段都有验收标准。见 **[TUTORIAL.md](TUTORIAL.md)**。

## 增删新闻源

编辑 `scripts/sources.yaml`，新增一条：

```yaml
  - id: example
    name: 示例媒体
    url: https://example.com/feed
    category: tech   # 或 finance
    homepage: https://example.com
```

再次运行 `fetch_news.py` 或等下一次 Actions 定时任务即可生效。
