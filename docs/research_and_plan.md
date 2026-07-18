# 新闻网站项目 — 开源对比调研 & 实现方案

## 0. 需求要点回顾
- 尽可能利用免费、免注册的新闻/信息源（RSS、公开 API 等）
- 直接部署到 GitHub Pages 或 Vercel
- 基本免维护，能自动更新新闻内容
- 个人项目，不需要用户系统、评论等重交互功能

## 1. 调研对象

| 项目 | Star/热度 | 定位 | 前端技术栈 | 后端/数据获取 | 部署方式 | 更新机制 |
|---|---|---|---|---|---|---|
| [NewsNow](https://github.com/ourongxing/newsnow) | 高（热门趋势项目） | 实时热点新闻聚合阅读（微博热搜、知乎热榜、GitHub Trending 等多源） | Vue/Nuxt 风格 SPA，UI 精美 | Server 端按源实时抓取 + 智能缓存（默认缓存 30 分钟），需要 KV/数据库做缓存持久化 | 主推 Cloudflare Pages / Docker；**Vercel 需要自己解决数据库/KV**，不是纯静态 | 请求时按需抓取+缓存，非"预生成静态页" |
| [DailyHotApi](https://github.com/imsyy/DailyHotApi) | 高 | 聚合热榜数据的 **API 服务**（微博/知乎/B站/抖音等热榜），提供 JSON + RSS 两种输出 | 无前端（纯 API），有配套的独立前端项目 DailyHot | Node.js + Koa，按路由实时抓取各平台接口 | 支持 Vercel 一键部署、Docker、Railway | 请求时实时抓取（可设缓存时间），本质是"动态 API 服务"而非静态站 |
| [RSSHub](https://github.com/DIYgod/RSSHub) | 极高（3万+ star） | 把"万物"转成 RSS 的中间层（几乎任何网站都能生成RSS路由） | 无前端，纯路由服务 | TypeScript + Node.js，社区维护上千个路由 | Docker/Node 部署，也有公共实例可直接用（免部署） | 请求时实时抓取，可配置缓存 |

## 2. 功能与架构对比

**NewsNow**
- 优点：UI 体验好，多源聚合、实时性强，支持登录同步（可选）。
- 缺点：本质是"动态服务"（抓取+缓存依赖 KV/数据库），**不适合纯 GitHub Pages 静态托管**；Vercel 部署官方也说需要自己配置数据库，不是开箱即用的静态方案；对"免维护静态站"的目标不太匹配，更偏向自托管一个可长期运行的服务。

**DailyHotApi**
- 优点：热榜数据全（微博/知乎/B站/抖音/GitHub趋势等几十个源），JSON + RSS 双格式，Vercel 一键部署方便。
- 缺点：本质是 API 服务，不是新闻网站本身，你还需要自己写前端消费这个 API；实时抓取意味着每次访问都触发抓取（有次数/频率限制风险），不是预生成好的静态页面，跟"GitHub Pages 纯静态 + 自动更新"的思路不完全一致（GitHub Pages 不能跑 Node 服务端逻辑）。

**RSSHub**
- 优点：路由生态最丰富，几乎任何站点/App 都能拿到 RSS，是绝佳的"数据源"层；有公共实例可以直接白嫖，不用自己部署也能拿 RSS。
- 缺点：同样是服务端实时抓取型项目，本身不产出新闻网站页面，需要自己在其上层做"抓取快照 → 生成静态页 → 部署"这一步。

## 3. 关键结论：GitHub Pages/Vercel + 免维护 + 自动更新 的正确架构模式

上面三个项目都属于"**动态服务型**"（Node/Koa 常驻进程实时抓取），跟 GitHub Pages 的纯静态本质是冲突的。真正契合"GitHub Pages + 免维护 + 自动更新"这个目标的经典模式是：

> **GitHub Actions 定时任务（cron）+ 静态站点生成器（SSG）+ GitHub Pages 部署**
> 即：不需要常驻服务器，用 GitHub Actions 按计划（比如每小时/每天）跑一个抓取脚本，把 RSS/公开 API 数据拉下来，生成静态 HTML/JSON，再自动 commit 到 gh-pages 分支或触发 Pages 部署。

这个模式的知名例子：
- GitHub 官方博客推荐的 "Jekyll + Feed" 只是生成 RSS，不是消费 RSS，但同一套 Actions + Pages 组合完全可以反过来做"抓取生成"。
- 大量个人"每日热榜静态归档"仓库（如 various "TodayHot" 归档仓库）都是这个套路：Actions 抓取 → 生成 Markdown/HTML → push → Pages 自动发布。

**为什么这个模式最适合你：**
1. 完全免费：GitHub Actions 免费额度（公开仓库无限分钟数）+ GitHub Pages 免费托管。
2. 真正免维护：没有服务器要维护，没有数据库要备份，抓取失败最多这次没更新，下次 cron 再跑。
3. 数据源可以直接用免费 RSS（几乎所有新闻网站、门户、科技媒体都提供 RSS，无需注册无需 Key），也可以叠加 RSSHub 的公共实例作为"没有官方 RSS 的站点"的补充源。
4. 如果你更想要动态、实时、可交互（比如登录同步阅读状态），那应该走 NewsNow 那种 Serverless+KV 路线，部署到 Vercel/Cloudflare；但那就不是"纯静态免维护"了，需要维护一个 KV/DB。

## 4. 给你的实现方案

### 4.1 总体架构（推荐：静态优先方案）

```
[免费新闻源: RSS feeds / 公开JSON API]
        │  (每小时/每天由 GitHub Actions 定时触发)
        ▼
[抓取脚本 Python/Node: 拉取 + 去重 + 清洗 + 分类]
        │
        ▼
[生成静态站点: 用 SSG（如 Astro / Hugo / 11ty）渲染 HTML + JSON 数据]
        │
        ▼
[GitHub Actions 自动 commit/部署 → GitHub Pages 或 Vercel]
        │
        ▼
[用户访问纯静态页面，无需任何服务器]
```

### 4.2 技术栈选择

**抓取与生成层**
- 语言：Python（`feedparser` 解析 RSS 非常成熟）或 Node.js（`rss-parser`），二选一，Python 更省心
- 数据源：
  - 直接使用各大媒体/机构官方 RSS（免注册免Key）：如新华社、BBC、Reuters、The Verge、Hacker News、少数派、知乎日报等公开 RSS（可先拉一批国内外常见源做白名单）
  - 用公共 RSSHub 实例（`rsshub.app` 或自建）补充没有官方 RSS 的站点/热榜（如微博热搜、知乎热榜）
  - 可选叠加 Hacker News/GitHub Trending 等免费公开 API（无需 Key）
- 处理逻辑：去重（按标题/链接 hash）、按分类打标签、按时间排序、生成 JSON 数据文件（供前端渲染）

**静态站点生成层**
- 推荐 **Astro**：对"内容站/新闻聚合站"非常友好，支持内容集合（Content Collections）、按需生成静态页面，构建速度快，SEO 友好
- 备选 **Hugo**：构建更快（Go 编译），适合大量条目的场景；缺点是模板语言（Go template）不如写 JS/TS 顺手
- 前端呈现：首页按分类/时间展示新闻卡片列表，条目跳转到原文外链（不转载全文，规避版权问题），可加简单搜索（前端 JSON 全文检索，如 Pagefind）

**自动化与部署层**
- GitHub Actions：
  - `schedule` cron 定时（如每小时）触发抓取脚本
  - 脚本输出更新到 `data/*.json` 或直接触发 Astro 构建
  - 构建产物自动部署到 GitHub Pages（`actions/deploy-pages`）或者推送触发 Vercel 的 Git 集成自动构建
- 两个部署目标怎么选：
  - **GitHub Pages**：完全免费、有 GitHub Actions 原生支持，缺点是自定义域名/边缘缓存能力弱于 Vercel，且仅支持静态内容（正好符合你的需求）
  - **Vercel**：免费额度也很充足，构建触发更方便（Git push 自动构建），支持将来加一点点 Serverless Function（如果以后想加动态小功能），域名/CDN 体验更好
  - 建议：**优先 GitHub Pages**（因为你明确要求"免维护+自动更新"且不需要动态功能），Vercel 作为备选/以后想要更好 CDN 时再迁移，二者迁移成本很低（都是基于同一个静态产物）

### 4.3 MVP 功能范围
1. 聚合展示 5–10 个免费 RSS 源的最新新闻（可先按"科技/时事/开发者"几个分类）
2. 每小时（或每天）自动抓取更新，无需人工干预
3. 首页新闻列表（标题、来源、时间、摘要），点击跳转原文
4. 简单分类/标签筛选
5. 站内全文/标题搜索（纯前端，用 Pagefind 或类似的静态搜索方案）
6. RSS 输出（可选）：网站本身也生成一份聚合后的 RSS，方便别人订阅你聚合的内容

### 4.4 后续可迭代方向
- 增加更多数据源（RSSHub 自建实例，覆盖更多没有官方 RSS 的站点）
- 简单的"今日热榜"归档页面（按天生成历史存档，类似 DailyHot 的归档仓库玩法）
- 加入极简的关键词过滤/个性化（仍然全静态，用 URL 参数或前端 localStorage 实现，不需要后端）
- 如果未来真的需要用户系统/收藏功能，再考虑迁移到 Vercel + Serverless Function + 轻量 KV（如 Vercel KV / Cloudflare D1），参考 NewsNow 的思路

### 4.5 目录结构建议
```
new-project/
  scripts/
    fetch_news.py        # 抓取所有源，输出到 data/
    sources.yaml          # 免费RSS源列表配置
  data/
    latest.json            # 抓取后的结构化新闻数据
    archive/YYYY-MM-DD.json # 每日归档（可选）
  site/                     # Astro 项目
    src/
      pages/
        index.astro
        category/[slug].astro
      content/
    astro.config.mjs
  .github/
    workflows/
      fetch-and-deploy.yml   # cron 定时抓取 + 构建 + 部署
  docs/
    research_and_plan.md     # 本文件
```

## 6. 免费 RSS 源实测清单（科技/IT + 相关财经方向）

已用 curl 实测抓取可用性（HTTP 200 + 返回有效 RSS/XML 内容），结果如下：

### ✅ 已验证可用（可直接纳入 v1 源列表）

| 来源 | RSS 地址 | 说明 |
|---|---|---|
| 36氪 | `https://36kr.com/feed` | 综合科技资讯，含财经/创投类内容，更新频繁 |
| 爱范儿 | `https://www.ifanr.com/feed` | 科技/数码/产品，全文RSS，更新频率约每小时 |
| IT之家 | `https://www.ithome.com/rss/` | IT/数码资讯量大，更新非常频繁 |
| 少数派 | `https://sspai.com/feed` | 效率工具/数码类，更偏应用/生活方式，量较小但质量高 |
| 钛媒体 | `https://www.tmtpost.com/feed` | 科技+商业财经交叉报道，符合"科技相关财经"需求 |
| 雷峰网 | `https://www.leiphone.com/feed` | AI/科技行业报道 |

### ❌ 已测试但不可用/需额外处理

| 来源 | 问题 |
|---|---|
| V2EX (`v2ex.com/feed/*.xml`) | 请求直接超时（连接被拒/防火墙限制），需要 GitHub Actions 实测（不同网络环境可能表现不同），或改走 RSSHub 代理 |
| 驱动之家 (`rss.mydrivers.com`) | 猜测的路径 404，需要重新找准确 RSS 路径 |
| cnBeta | 走 Cloudflare 302 跳转，直接 curl 拿不到，需要处理跳转或用其他方式 |
| 华尔街见闻 (`wallstreetcn.com`) | 猜测路径不对（404/NoSuchKey），需要找到正确 RSS 地址或改用 API |
| 虎嗅 (`huxiu.com`) | 猜测路径 404，需另外确认其 RSS 是否已下线（虎嗅可能已取消公开 RSS） |
| 界面新闻 (`jiemian.com`) | 猜测路径 404 |
| GeekPark 极客公园 | 域名连接失败（0 返回），需重新确认域名/路径是否变更 |

> 以上"不可用"的大多是我**猜测的常见路径**没猜中，不代表该站一定没有 RSS——很多站会把 RSS 放在页面底部链接或改了路径。后续会用 RSSHub（`rsshub.app` 公共实例或自建）作为兜底：RSSHub 对国内绝大多数科技媒体、财经媒体、社区（如虎嗅、V2EX、华尔街见闻、雪球、36氪、知乎等）都有对应路由，可以覆盖这些"官方RSS没找到/已下线"的源。

### 建议的 v1 源组合（首批上线）
1. 36氪（综合科技+创投财经）
2. 爱范儿（科技/数码）
3. IT之家（IT/数码，更新量大）
4. 钛媒体（科技+财经交叉）
5. 雷峰网（AI/科技行业）
6. 少数派（效率/数码，量少但可作为补充）

后续通过 RSSHub 补充：V2EX 热门节点、虎嗅、华尔街见闻科技财经相关栏目、知乎科技类话题等，作为 v1.1 迭代内容。

## 7. 最终确认结果

| 项目 | 决定 |
|---|---|
| 更新频率 | 每小时（GitHub Actions cron: `0 * * * *`） |
| 领域 | 科技/IT + 相关财经新闻 |
| 语言 | 中文站 |
| 生成方式 | 静态生成（**Astro**：结构化内容渲染友好，构建速度对本项目量级完全够用，比 Hugo 的 Go template 更易维护） |
| 部署 | **GitHub Pages 优先上线**；架构上保持产物通用（纯静态构建产物），保留随时无痛切换/追加 Vercel 部署的能力 |
| RSS 源 v1 | 36氪、爱范儿、IT之家、钛媒体、雷峰网、少数派（已实测可用），后续用 RSSHub 补充 V2EX/虎嗅/华尔街见闻等 |

## 8. 下一步
源清单已确认可用，接下来开始搭建代码骨架：
1. 初始化 Astro 项目 + 目录结构
2. 写抓取脚本（Python + feedparser），实现去重/清洗/分类
3. 编写 GitHub Actions workflow（定时抓取 + 构建 + 部署 GitHub Pages）
4. 首页/分类页模板

如果你对 v1 源列表没有异议，我就直接开始动手搭建。
