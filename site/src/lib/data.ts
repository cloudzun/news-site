// 在构建时读取仓库根目录 data/latest.json，供各页面消费。
// 不放到 site/public 里是为了让抓取脚本和站点目录解耦（脚本只管写 data/，站点只管读 data/）。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export interface NewsItem {
  id: string;
  title: string;
  link: string;
  source_id: string;
  source_name: string;
  category: string;
  published_at: string;
  summary: string;
  fetched_at: string;
}

export interface SourceMeta {
  id: string;
  name: string;
  category: string;
}

export interface LatestData {
  generated_at: string;
  count: number;
  sources: SourceMeta[];
  items: NewsItem[];
}

export interface DayGroup {
  date: string; // YYYY-MM-DD（按北京时间）
  label: string;
  isToday: boolean;
  items: NewsItem[];
  count: number;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// site/src/lib -> 仓库根目录 data/latest.json
const DATA_PATH = path.resolve(__dirname, '../../../data/latest.json');

let cache: LatestData | null = null;

export function loadLatest(): LatestData {
  if (cache) return cache;
  try {
    const raw = readFileSync(DATA_PATH, 'utf-8');
    cache = JSON.parse(raw) as LatestData;
  } catch (e) {
    console.warn(`[WARN] 无法读取 ${DATA_PATH}，将使用空数据集。请先运行 scripts/fetch_news.py`, e);
    cache = { generated_at: new Date().toISOString(), count: 0, sources: [], items: [] };
  }
  return cache;
}

export function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function formatClock(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return iso;
  }
}

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60_000);
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin} 分钟前`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH} 小时前`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD} 天前`;
    return formatDayLabel(iso.slice(0, 10));
  } catch {
    return iso;
  }
}

export function shanghaiHour(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  return new Date(d.getTime() + d.getTimezoneOffset() * 60000 + SHANGHAI_OFFSET_MS).getHours();
}

export const CATEGORY_LABELS: Record<string, string> = {
  tech: '科技 / IT',
  finance: '财经相关',
};

// 站点以北京时间（UTC+8）为"一天"的边界；北京无夏令时，直接用固定偏移换算。
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

export function shanghaiDateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const sh = new Date(d.getTime() + d.getTimezoneOffset() * 60000 + SHANGHAI_OFFSET_MS);
  return sh.toISOString().slice(0, 10);
}

export function formatDayLabel(dateKey: string, isToday = false): string {
  const [, m, d] = dateKey.split('-').map(Number);
  return isToday ? `${m}月${d}日（今天）` : `${m}月${d}日`;
}

/**
 * 按北京时间把最新数据分成最近 7 个自然日的分组（今天在前）。
 * 超过 7 天的条目不会出现在任何分组中，站点也因此不会生成对应页面。
 */
export function loadDays(): DayGroup[] {
  const data = loadLatest();
  const byDay = new Map<string, NewsItem[]>();
  for (const item of data.items) {
    const key = shanghaiDateKey(item.published_at);
    const list = byDay.get(key);
    if (list) list.push(item);
    else byDay.set(key, [item]);
  }

  const ref = shanghaiDateKey(data.generated_at || new Date().toISOString());
  const refTime = new Date(`${ref}T00:00:00Z`).getTime();
  const days: DayGroup[] = [];
  for (let i = 0; i < 7; i++) {
    const key = new Date(refTime - i * 86_400_000).toISOString().slice(0, 10);
    const items = (byDay.get(key) ?? []).sort((a, b) =>
      b.published_at.localeCompare(a.published_at),
    );
    days.push({
      date: key,
      label: formatDayLabel(key, i === 0),
      isToday: i === 0,
      items,
      count: items.length,
    });
  }
  return days;
}
