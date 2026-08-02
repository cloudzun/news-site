# 新闻聚合站：从 PRD 到部署的 Coding Agent 实战教程

配套参考仓库：[github.com/cloudzun/news-site](https://github.com/cloudzun/news-site)
（本教程与成品代码都在这里，可对照学习）

## 教程目标

学员用 Coding Agent（如 Codex）完成一次完整的"需求 → 开发 → 自定义 → 发布"闭环：
拿到一份 PRD，让 Agent 从零做出一个每天自动更新的科技新闻聚合站，再按自己的喜好
自定义（内容方向、页面风格），最后推送到 GitHub，部署到 GitHub Pages，
并用 Docker 把镜像发布到 Docker Hub。

本教程只给"思路 + 提示词"，具体实现细节由 Coding Agent 与学员在对话中完成。

---

## 阶段 0：准备（10 分钟）

确认以下账号，后面的阶段会用到（不要求现在全部配好）：

- GitHub 账号（发布代码、GitHub Pages、Actions）
- Docker Hub 账号（推送镜像；注意：网页可用 GitHub 登录，但推送需要创建 Access Token）
- （可选）Vercel 账号

打开 Coding Agent，给它一句总指令：

> 你是一个全栈开发助手。接下来我会分阶段给你任务，请一步步帮我完成一个每天自动更新的
> 科技新闻聚合站，从写代码到部署。每个阶段先告诉我你的计划，再动手。

---

## 阶段 1：用 PRD 让 Agent 做出第一版页面

把下面的 PRD 整段复制给 Agent，加上"请先做出第一个可用版本"。

### 学员提示词

> 下面是产品需求文档（PRD），请根据它实现第一个可用版本：数据真实可用，桌面和手机都能
> 正常看。先搭出整体页面，再完善细节。

### PRD（可整段复制）

```markdown
# 产品需求文档：科技新闻聚合站

## 1. 产品概述
一个几乎零维护的中文科技/IT + 相关财经新闻聚合站，每小时自动更新。
数据来自公开免费 RSS，无需注册、无需 API Key；静态优先，无需后端与数据库。

## 2. 功能需求

### 2.1 新闻抓取与数据
- 从免费 RSS 源抓取新闻，清洗、去重、按 tech / finance 分类
- 每小时自动更新（GitHub Actions 定时任务），无需人工维护
- 数据以 JSON 文件存储（latest.json + 按天归档），只保留最近 7 天

### 2.2 首页与每日页面
- 首页直接展示当天新闻（用户打开就能看，不需要点击）
- 每天的新闻独立一页 /day/YYYY-MM-DD/
- 最近 7 天通过导航/链接访问；超过 7 天的新闻不生成页面、不展示

### 2.3 新闻卡片
- 标题、来源、分类徽章、发布时间、摘要；点击跳转原文

### 2.4 移动端
- 适配手机：可横向滑动的日期导航、足够大的触控目标、明暗配色自适应

## 3. 技术要求
- 抓取：Python（feedparser），源配置在 scripts/sources.yaml
- 站点：Astro 静态生成，构建时读取 JSON 数据
- 部署：GitHub Pages + GitHub Actions（每小时 cron）
- 中文界面

## 4. 数据源（参考清单，可扩充）
以下 6 个免费 RSS 源已实测可用，用于快速搭建 MVP；它们不是固定不变的，
请根据内容定位和目标读者评估是否需要补充更合适的中文科技/财经源
（不同媒体、细分领域、RSSHub 兜底等）：

| id | 名称 | RSS 地址 | 分类 |
|---|---|---|---|
| 36kr | 36氪 | https://36kr.com/feed | finance |
| ifanr | 爱范儿 | https://www.ifanr.com/feed | tech |
| ithome | IT之家 | https://www.ithome.com/rss/ | tech |
| tmtpost | 钛媒体 | https://www.tmtpost.com/feed | finance |
| leiphone | 雷峰网 | https://www.leiphone.com/feed | tech |
| sspai | 少数派 | https://sspai.com/feed | tech |

## 5. 验收标准
- 首页能看到当天真实新闻，数据来自真实 RSS
- 桌面与移动端布局正常，无溢出
- 本地能跑通：抓取 → 构建 → 预览
```

### 与 Agent 的互动要点

第一版出来后，用对话继续打磨，例如：

> 首页把所有新闻堆在一页了，请改成每天一页：首页直接展示当天新闻，
> 最近 7 天用链接访问，超过 7 天的内容不要生成页面，抓取脚本也只保留 7 天
>
> 页面太朴素了，参考新闻聚合站美化：吸顶导航、日期 Tab、分类徽章、相对时间、
> 当天新闻按小时分组
>
> 移动端看一下，日期 Tab 能不能横滑，触控目标够不够大

原则：**你只提需求和感受，具体怎么实现交给 Agent。**

---

## 阶段 2：按自己的需求自定义

想 2-3 个自己的需求，用一句话描述给 Agent。参考方向：

- 内容类：换一个主题方向（财经/体育/动漫）、增加某类新闻源、去掉某些分类
- 功能类：增加标题搜索、生成聚合 RSS 输出、收藏/稍后读
- 外观类：深色主题、某个配色、更极简/更信息流、调整卡片密度

### 学员提示词模板

> 在此基础上增加一个功能：<一句话描述需求>。
> 内容上我想：<一句话描述想要的方向/源>。
> 外观上我想：<一句话描述想要的风格>。
> 改完后请告诉我改了什么，并重新验证页面没有报错。

---

## 阶段 3：推送到 GitHub

确认 GitHub 已登录（学员电脑装好 GitHub CLI 或直接用网页操作）。目标：让项目成为一个
独立的 GitHub 仓库。

### 学员提示词模板

> 把当前项目初始化成 git 仓库（注意只包含本项目，不要包含无关目录），提交代码，
> 然后在我的 GitHub 账号下创建公开仓库并推送。完成后告诉我仓库地址。

预期结果：一个形如 `https://github.com/<你的账号>/news-site` 的仓库地址。

---

## 阶段 4：部署上线（GitHub Pages）

> 帮我把项目部署到 GitHub Pages，并配置 GitHub Actions：每小时自动抓取新闻 →
> 构建 → 部署。完成后给我线上地址和 Actions 查看方法。
> 注意：我们人工的功能提交不要带 [skip ci]，否则不会触发构建。

预期结果：`https://<你的账号>.github.io/news-site/`（或自定义域名），
Actions 全部绿色，每小时自动更新。

可选：如果还想部署到 Vercel，让它把 `site/` 目录导入 Vercel（数据仍由 Actions 抓取）。

---

## 阶段 5：Docker 化并推送到 Docker Hub

目标：项目里有 Dockerfile，GitHub 每次推送代码都自动构建镜像并推到 Docker Hub。

### 第一步：让 Agent 写 Docker 相关文件

> 为项目编写 Dockerfile（Node + Python + nginx 单容器）、.dockerignore、docker-compose.yml，
> 并添加 GitHub Actions 工作流：每次 push 到 main 时自动构建镜像并推送到我的 Docker Hub。
> 要求：
> 1. 容器启动时自己抓取当天新闻并构建，之后每小时自动更新
> 2. 镜像不内置任何历史新闻数据（.dockerignore 排除 data/）
> 3. 未配置 Docker Hub 凭据时只构建不推送，保证 CI 不红

### 第二步：准备 Docker Hub 凭据（学员自己操作，Agent 无法代办）

1. 注册/登录 Docker Hub，记住用户名
2. 创建访问令牌：Account Settings → Security → New Access Token
   **权限务必选择 Read & Write**（只读令牌无法推送镜像）
3. 到 GitHub 仓库 Settings → Secrets and variables → Actions，添加两个 Secret：
   - `DOCKERHUB_USERNAME` = Docker Hub 用户名
   - `DOCKERHUB_TOKEN` = 刚才的访问令牌

### 第三步：触发构建并验证

> 我已经配好 Docker Hub 的 Secret，请手动触发一次构建工作流，并帮我校验镜像是否
> 出现在 Docker Hub 上。

预期结果：

- GitHub Actions 运行成功
- Docker Hub 出现 `<你的用户名>/news-site`，含 `latest` 标签
- 本地验证（有 Docker 的机器）：

```bash
docker pull <你的用户名>/news-site
docker run -d -p 8080:80 -v news-data:/app/data --name news-site \
  --restart unless-stopped <你的用户名>/news-site
# 浏览器访问 http://localhost:8080
```

---

## 常见问题速查

- **push 后 Actions 没触发**：提交信息带了 `[skip ci]`，或改动文件不在路径过滤内；
  去掉标记后重推，或到 Actions 页手动 Run workflow
- **页面一直不更新**：确认 cron 是否生效；GitHub Pages 有缓存可强制刷新
- **容器显示 nginx 欢迎页**：Debian 默认站点和我们的配置冲突，构建时删除
  `/etc/nginx/sites-enabled/default` 并配置 `default_server`
- **Docker Hub 推送报 "insufficient scopes"**：令牌是只读权限，重新创建时选 Read & Write
- **拉 `latest` 拿到旧镜像**：Docker 镜像加速缓存，用 commit-sha tag 拉取或 `docker rmi` 后重拉
- **首次启动就有一周新闻**：RSS 源会回推历史条目，抓取脚本只入库"当天"发布的新条目
- **容器数据不干净**：旧的数据卷还在，先 `docker volume rm news-data` 再起容器

---

## 最终验收清单

- [ ] 页面能访问，当天新闻真实可读
- [ ] 至少完成了一项自定义需求
- [ ] 项目已推送到自己的 GitHub 仓库
- [ ] GitHub Pages 线上地址可访问且每小时自动更新
- [ ] Docker Hub 上能看到自己的镜像
- [ ] 容器启动后自己抓当天新闻并逐日积累

---

## 附录：参考示例与验证资源

以下是本教程配套的参考实现（由教师维护），学员可以对照检查自己的成果。
注意：学员自己完成后的仓库地址、站点地址和镜像名都会不同，请以自己得到的为准。

### 1. 参考实现

- GitHub 仓库：<https://github.com/cloudzun/news-site>
- 教程文档：仓库内 `TUTORIAL.md`（即本文档）

### 2. 在线示例网站

- GitHub Pages 示例：<https://www.cloudzun.com/news-site/>

### 3. Docker 镜像验证

- 镜像名：`chengzh/news-site`
- Docker Hub 页面：<https://hub.docker.com/r/chengzh/news-site>
- 拉取并运行：

```bash
docker pull chengzh/news-site
docker run -d -p 8080:80 -v news-data:/app/data --name news-site \
  --restart unless-stopped chengzh/news-site
# 浏览器访问 http://localhost:8080
```

### 4. 快速自查命令

- 代码是否推送成功：打开自己的 GitHub 仓库地址，能看到代码与提交记录
- 线上页面是否正常：打开自己的站点，能看到当天新闻
- 镜像是否可用：

```bash
docker images          # 能看到本地镜像
docker run -d -p 8080:80 -v news-data:/app/data --name news-site <自己的镜像名>
# 访问 http://localhost:8080 能显示页面
```
