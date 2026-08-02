#!/usr/bin/env bash
# 容器入口：启动时抓取+构建一次，之后每小时第 5 分钟自动更新（与 GitHub Actions cron 节奏一致）
set -e

echo "[entrypoint] 首次抓取新闻..."
if ! python3 scripts/fetch_news.py; then
  echo "[entrypoint] 首次抓取失败，保留已有数据继续启动"
fi

echo "[entrypoint] 构建站点..."
if ! (cd site && npm run build); then
  echo "[entrypoint] 首次构建失败，保留已有产物继续启动"
fi

echo "[entrypoint] 启动 nginx 服务 dist ..."
nginx -g 'daemon off;' &
NGINX_PID=$!

while true; do
  now=$(date +%s)
  next=$(( (now / 3600 + 1) * 3600 + 300 ))   # 下一个整点 + 5 分钟
  sleep $(( next - now ))

  echo "[entrypoint] $(date -u +%Y-%m-%dT%H:%M:%SZ) 每小时自动更新开始"
  if python3 scripts/fetch_news.py; then
    if (cd site && npm run build); then
      echo "[entrypoint] 更新完成"
    else
      echo "[entrypoint] 本次构建失败，继续服务旧产物"
    fi
  else
    echo "[entrypoint] 本次抓取失败（可能是网络或全部源异常），继续服务旧数据"
  fi
done
