import fs from 'node:fs/promises';
import { Router } from 'express';
import {
  HttpError,
  IMAGE_FILE_RE,
  assertId,
  compareScreens,
  flowFile,
  listScreens,
  newId,
  readFlow,
  readJson,
  requireProject,
  screenFile,
  today,
  withFileLock,
  writeJson,
} from '../store.js';
import type { HistoryEntry, Screen, ScreenImage, ScreenItem } from '../types.js';

const r = Router({ mergeParams: true });

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {});
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const ratio = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : null);
const size = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : 0);
const id = (v: unknown) => (typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : newId());
const DEFAULT_MARKER_SIZE = 24;
const markerSize = (v: unknown) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : DEFAULT_MARKER_SIZE;
  return Math.min(48, Math.max(14, n));
};

function sanitizeImage(v: unknown): ScreenImage | null {
  const o = obj(v);
  if (typeof o.file !== 'string' || !IMAGE_FILE_RE.test(o.file)) return null;
  return { file: o.file, width: size(o.width), height: size(o.height) };
}

/** 클라이언트가 보낸 화면 데이터에서 알려진 필드만 골라 정리한다 */
function sanitizeScreen(input: unknown, cur: Screen): Screen {
  const i = obj(input);
  const items: ScreenItem[] = (Array.isArray(i.items) ? i.items : []).slice(0, 500).map((v, idx) => {
    const it = obj(v);
    return {
      id: id(it.id),
      no: idx + 1,
      name: str(it.name, 200),
      type: str(it.type, 50),
      description: str(it.description, 5000),
      remark: str(it.remark, 1000),
      x: ratio(it.x),
      y: ratio(it.y),
    };
  });
  const history: HistoryEntry[] = (Array.isArray(i.history) ? i.history : []).slice(0, 1000).map((v) => {
    const h = obj(v);
    return {
      id: id(h.id),
      version: str(h.version, 30),
      date: str(h.date, 30),
      by: str(h.by, 100),
      summary: str(h.summary, 2000),
    };
  });
  return {
    ...cur,
    screenCode: str(i.screenCode, 100).trim(),
    name: str(i.name, 200).trim(),
    menuPath: str(i.menuPath, 500),
    author: str(i.author, 100),
    version: str(i.version, 30),
    description: str(i.description, 10000),
    image: sanitizeImage(i.image),
    markerSize: markerSize(i.markerSize),
    items,
    history,
  };
}

async function assertUniqueCode(pid: string, code: string, exceptId?: string) {
  if (!code) return;
  const dup = (await listScreens(pid)).find((s) => s.screenCode === code && s.id !== exceptId);
  if (dup) throw new HttpError(400, `화면ID '${code}'는 이미 '${dup.name}' 화면에서 사용 중입니다`);
}

r.get('/', async (req, res) => {
  const project = await requireProject((req.params as Obj).pid);
  const screens = await listScreens(project.id);
  res.json(
    screens
      .map((s) => ({
        id: s.id,
        screenCode: s.screenCode,
        name: s.name,
        menuPath: s.menuPath,
        version: s.version,
        image: s.image,
        itemCount: s.items.length,
        updatedAt: s.updatedAt,
        updatedBy: s.updatedBy,
      }))
      .sort(compareScreens),
  );
});

r.post('/', async (req, res) => {
  const project = await requireProject((req.params as Obj).pid);
  const body = obj(req.body);
  const name = str(body.name, 200).trim();
  if (!name) throw new HttpError(400, '화면명을 입력하세요');
  const screenCode = str(body.screenCode, 100).trim();
  const by = str(body.by, 100);
  await assertUniqueCode(project.id, screenCode);
  const now = new Date().toISOString();
  const screen: Screen = {
    id: newId(),
    projectId: project.id,
    screenCode,
    name,
    menuPath: str(body.menuPath, 500),
    author: by,
    version: '1.0',
    description: '',
    image: null,
    markerSize: DEFAULT_MARKER_SIZE,
    items: [],
    history: [{ id: newId(), version: '1.0', date: today(), by, summary: '최초 작성' }],
    createdAt: now,
    updatedAt: now,
    updatedBy: by,
  };
  await writeJson(screenFile(project.id, screen.id), screen);
  res.status(201).json(screen);
});

r.get('/:sid', async (req, res) => {
  const project = await requireProject((req.params as Obj).pid);
  const screen = await readJson<Screen>(screenFile(project.id, assertId(req.params.sid)));
  if (!screen) throw new HttpError(404, '화면을 찾을 수 없습니다');
  res.json(screen);
});

r.put('/:sid', async (req, res) => {
  const project = await requireProject((req.params as Obj).pid);
  const sid = assertId(req.params.sid);
  const body = obj(req.body);
  const file = screenFile(project.id, sid);
  const saved = await withFileLock(file, async () => {
    const cur = await readJson<Screen>(file);
    if (!cur) throw new HttpError(404, '화면을 찾을 수 없습니다');
    // 낙관적 잠금: 불러온 뒤 다른 사람이 먼저 저장했다면 거부한다
    if (body.force !== true && body.baseUpdatedAt !== cur.updatedAt) {
      throw new HttpError(409, '다른 사용자가 먼저 수정했습니다', {
        updatedAt: cur.updatedAt,
        updatedBy: cur.updatedBy,
      });
    }
    const next = sanitizeScreen(body.screen, cur);
    if (!next.name) throw new HttpError(400, '화면명을 입력하세요');
    await assertUniqueCode(project.id, next.screenCode, sid);
    next.updatedAt = new Date().toISOString();
    next.updatedBy = str(body.by, 100);
    await writeJson(file, next);
    return next;
  });
  res.json(saved);
});

r.delete('/:sid', async (req, res) => {
  const project = await requireProject((req.params as Obj).pid);
  const sid = assertId(req.params.sid);
  await withFileLock(screenFile(project.id, sid), () => fs.rm(screenFile(project.id, sid), { force: true }));
  // 흐름도에서도 이 화면과 연결선을 지운다
  await withFileLock(flowFile(project.id), async () => {
    const flow = await readFlow(project.id);
    if (!flow.nodes[sid] && !flow.edges.some((e) => e.from === sid || e.to === sid)) return;
    delete flow.nodes[sid];
    flow.edges = flow.edges.filter((e) => e.from !== sid && e.to !== sid);
    await writeJson(flowFile(project.id), flow);
  });
  res.status(204).end();
});

export default r;
