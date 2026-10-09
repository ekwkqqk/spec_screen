export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface ProjectSummary extends Project {
  screenCount: number;
  lastUpdated: string;
}

export interface ScreenItem {
  id: string;
  no: number;
  name: string;
  type: string;
  description: string;
  remark: string;
  /** 이미지 대비 0~1 비율 좌표. 마커가 없으면 null */
  x: number | null;
  y: number | null;
}

export interface HistoryEntry {
  id: string;
  version: string;
  date: string;
  by: string;
  summary: string;
}

export interface ScreenImage {
  file: string;
  width: number;
  height: number;
}

export interface Screen {
  id: string;
  projectId: string;
  screenCode: string;
  name: string;
  menuPath: string;
  author: string;
  version: string;
  description: string;
  image: ScreenImage | null;
  /** 번호 마커 표시 크기(px). 기본 24 */
  markerSize: number;
  items: ScreenItem[];
  history: HistoryEntry[];
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export const DEFAULT_MARKER_SIZE = 24;
export const MARKER_SIZE_MIN = 14;
export const MARKER_SIZE_MAX = 48;

export function clampMarkerSize(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : DEFAULT_MARKER_SIZE;
  return Math.min(MARKER_SIZE_MAX, Math.max(MARKER_SIZE_MIN, n));
}

export interface ScreenSummary {
  id: string;
  screenCode: string;
  name: string;
  menuPath: string;
  version: string;
  image: ScreenImage | null;
  itemCount: number;
  updatedAt: string;
  updatedBy: string;
}

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  sourceHandle: string | null;
  targetHandle: string | null;
}

export interface Flow {
  /** w, h: 사용자가 조절한 노드 크기. 없으면 기본 크기 */
  nodes: Record<string, { x: number; y: number; w?: number; h?: number }>;
  edges: FlowEdge[];
  updatedAt: string | null;
  updatedBy: string;
}

export interface ProjectExport {
  project: Project;
  screens: Screen[];
  flow: Flow;
}

export const ITEM_TYPES = ['버튼', '입력', '선택', '체크/라디오', '조회조건', '표/목록', '링크', '텍스트', '팝업', '기타'];
