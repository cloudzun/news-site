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

export const CATEGORY_LABELS: Record<string, string> = {
  tech: '科技 / IT',
  finance: '财经相关',
};
