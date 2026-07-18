"""
fetch_news.py
从 sources.yaml 定义的免费 RSS 源抓取新闻，去重、清洗、合并，
输出到 data/latest.json（供 Astro 静态站点消费）以及 data/archive/YYYY-MM-DD.json（每日归档）。

设计目标：
- 无需数据库，纯文件存储，天然适合 GitHub Actions + GitHub Pages 的无状态流水线
- 抓取失败的源不应影响其他源（单源异常隔离）
- 增量合并：保留 retain_hours 内的旧条目 + 本次新抓到的条目，按链接去重
"""
from __future__ import annotations

import hashlib
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import feedparser
import requests
import yaml

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
ARCHIVE_DIR = DATA_DIR / "archive"
SOURCES_FILE = Path(__file__).resolve().parent / "sources.yaml"
LATEST_FILE = DATA_DIR / "latest.json"


def load_config() -> dict:
    with open(SOURCES_FILE, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def make_id(link: str, title: str) -> str:
    """基于链接(或标题兜底)生成稳定去重 ID"""
    key = link.strip() if link else title.strip()
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:16]


def parse_entry_time(entry) -> str:
    """尽量拿到发布时间，取不到就用当前时间（ISO 8601, UTC）"""
    for field in ("published_parsed", "updated_parsed"):
        t = getattr(entry, field, None)
        if t:
            try:
                dt = datetime(*t[:6], tzinfo=timezone.utc)
                return dt.isoformat()
            except Exception:
                pass
    return datetime.now(timezone.utc).isoformat()


def clean_summary(raw: str, max_len: int = 200) -> str:
    """极简去 HTML 标签摘要（不引入额外依赖，够用即可）"""
    if not raw:
        return ""
    import re

    text = re.sub(r"<[^>]+>", "", raw)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:max_len]


def fetch_source(source: dict, settings: dict) -> list[dict]:
    """抓取单个源，异常时打印警告并返回空列表，不影响整体流程"""
    sid = source["id"]
    url = source["url"]
    headers = {"User-Agent": settings.get("user_agent", "Mozilla/5.0")}
    timeout = settings.get("timeout_seconds", 15)

    try:
        resp = requests.get(url, headers=headers, timeout=timeout)
        resp.raise_for_status()
        parsed = feedparser.parse(resp.content)
    except Exception as e:
        print(f"[WARN] 抓取失败: {sid} ({url}) -> {e}", file=sys.stderr)
        return []

    if parsed.bozo and not parsed.entries:
        print(f"[WARN] 解析失败/无条目: {sid} ({url}) -> {parsed.bozo_exception}", file=sys.stderr)
        return []

    max_items = settings.get("max_items_per_source", 30)
    items = []
    for entry in parsed.entries[:max_items]:
        title = getattr(entry, "title", "").strip()
        link = getattr(entry, "link", "").strip()
        if not title or not link:
            continue
        summary_raw = getattr(entry, "summary", "") or getattr(entry, "description", "")
        items.append(
            {
                "id": make_id(link, title),
                "title": title,
                "link": link,
                "source_id": sid,
                "source_name": source["name"],
                "category": source["category"],
                "published_at": parse_entry_time(entry),
                "summary": clean_summary(summary_raw),
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            }
        )
    print(f"[OK] {sid}: 抓到 {len(items)} 条")
    return items


def load_existing_latest() -> list[dict]:
    if LATEST_FILE.exists():
        try:
            with open(LATEST_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("items", [])
        except Exception as e:
            print(f"[WARN] 读取旧 latest.json 失败: {e}", file=sys.stderr)
    return []


def merge_and_dedupe(old_items: list[dict], new_items: list[dict], retain_hours: int) -> list[dict]:
    by_id: dict[str, dict] = {}
    for item in old_items + new_items:
        # 新条目会覆盖旧条目（同 id 时以后抓到的为准，保留最新 summary/标题等）
        by_id[item["id"]] = item

    cutoff = datetime.now(timezone.utc) - timedelta(hours=retain_hours)
    result = []
    for item in by_id.values():
        try:
            pub = datetime.fromisoformat(item["published_at"])
            if pub.tzinfo is None:
                pub = pub.replace(tzinfo=timezone.utc)
        except Exception:
            pub = datetime.now(timezone.utc)
        if pub >= cutoff:
            result.append(item)

    result.sort(key=lambda x: x["published_at"], reverse=True)
    return result


def write_latest(items: list[dict], sources_meta: list[dict]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "count": len(items),
        "sources": sources_meta,
        "items": items,
    }
    with open(LATEST_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"[OK] 写入 {LATEST_FILE}，共 {len(items)} 条")


def write_archive(items: list[dict]) -> None:
    """按天归档快照，方便以后做历史回顾页面"""
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    archive_file = ARCHIVE_DIR / f"{today}.json"
    with open(archive_file, "w", encoding="utf-8") as f:
        json.dump(
            {"date": today, "count": len(items), "items": items},
            f,
            ensure_ascii=False,
            indent=2,
        )
    print(f"[OK] 写入归档 {archive_file}")


def main() -> int:
    config = load_config()
    sources = config.get("sources", [])
    settings = config.get("settings", {})

    all_new_items: list[dict] = []
    ok_count = 0
    for source in sources:
        items = fetch_source(source, settings)
        if items:
            ok_count += 1
        all_new_items.extend(items)

    if ok_count == 0:
        print("[ERROR] 所有源都抓取失败，保留旧数据不覆盖，退出非零码", file=sys.stderr)
        return 1

    old_items = load_existing_latest()
    merged = merge_and_dedupe(old_items, all_new_items, settings.get("retain_hours", 168))

    sources_meta = [{"id": s["id"], "name": s["name"], "category": s["category"]} for s in sources]
    write_latest(merged, sources_meta)
    write_archive(merged)

    print(f"[SUMMARY] 成功源: {ok_count}/{len(sources)}，本次新抓取: {len(all_new_items)}，合并后总条目: {len(merged)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
