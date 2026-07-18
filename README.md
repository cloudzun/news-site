# 科技新闻速览（自动聚合站）

一个几乎零维护的科技/IT + 相关财经新闻聚合站：
- 免费公开 RSS 源（无需注册/无需 API Key）
- GitHub Actions 每小时自动抓取、清洗、去重
- Astro 静态生成，部署到 GitHub Pages（也可一键迁移到 Vercel）

详细调研与方案见 [`docs/research_and_plan.md`](docs/research_and_plan.md)。

## 目录结构

```
scripts/            # 抓取脚本
  sources.yaml       # RSS 源配置（增删源在这里改）
  fetch_news.py       # 抓取 -> 清洗 -> 去重 -> 输出 data/
  requirements.txt
data/
  latest.json         # 最新聚合数据（Astro 构建时读取）
  archive/YYYY-MM-DD.json  # 每日归档快照
site/                # Astro 静态站点
  src/pages/          # 首页 + 分类页
  src/components/
  src/layouts/
  src/lib/data.ts     # 读取 data/latest.json 的工具函数
.github/workflows/
  fetch-and-deploy.yml   # 定时抓取 + 构建 + 部署 GitHub Pages
```

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

## 迁移/追加部署到 Vercel（可选）

`site/vercel.json` 已配置好构建参数。在 Vercel 后台 Import 这个仓库，
Root Directory 选 `site/`，其余保持默认即可。数据更新仍然由 GitHub Actions 的
定时任务负责抓取和 commit，Vercel 只需要在 `data/latest.json` 变化后重新构建
（可在 Vercel 项目里开启 "Git push 自动部署"）。

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
