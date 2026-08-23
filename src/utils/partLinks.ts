import type { Part } from '../types'

export interface PartLinkSite {
  key: string
  label: string
  url: (query: string) => string
}

export const PART_LINK_SITES: PartLinkSite[] = [
  {
    key: 'autodoc',
    label: 'Автодок',
    url: (q) => `https://www.autodoc.ru/search?keyword=${encodeURIComponent(q)}`,
  },
  {
    key: 'emex',
    label: 'Emex',
    url: (q) => `https://emex.ru/goods?text=${encodeURIComponent(q)}`,
  },
  {
    key: 'drom',
    label: 'Дром',
    url: (q) => `https://baza.drom.ru/sell_spare_parts/+/${encodeURIComponent(q)}/`,
  },
]

export function partSearchQuery(part: Pick<Part, 'articleNumber' | 'name'>): string {
  return part.articleNumber.trim() || part.name.trim()
}
