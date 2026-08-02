# 单容器方案：抓取(RSS) + Astro 构建 + nginx 托管，容器内每小时自动更新
#
# 用法：
#   docker build -t news-site .
#   docker run -d -p 8080:80 -v news-data:/app/data --name news-site news-site
# 然后访问 http://<主机>:8080/

# node:20 自带 Node（Astro 构建），Debian bookworm 提供 python3（抓取）与 nginx（托管）
FROM node:20-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

# 安装 python3 / nginx / curl（健康检查用），并创建 Python 虚拟环境
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 \
        python3-venv \
        nginx \
        curl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && python3 -m venv /opt/venv

WORKDIR /app

# 先装 Python 依赖（利用层缓存）
COPY scripts/requirements.txt scripts/requirements.txt
RUN pip install --no-cache-dir -r scripts/requirements.txt

# 再装 Node 依赖（利用层缓存）
COPY site/package.json site/package-lock.json site/
RUN cd site && npm ci --omit=dev

# 复制源码（.dockerignore 已排除 .git/node_modules/dist 等）
COPY . .

# 首次抓取 + 构建；失败不阻断，容器启动后 entrypoint 会再重试
RUN python3 scripts/fetch_news.py || true \
    && cd site && npm run build || true

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 80
VOLUME ["/app/data"]

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
