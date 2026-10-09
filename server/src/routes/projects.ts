import fs from 'node:fs/promises';
import { Router } from 'express';
import {
  HttpError,
  compareScreens,
  listProjectIds,
  listScreens,
  newId,
  projectDir,
  projectFile,
  readFlow,
  readJson,
  requireProject,
  withFileLock,
  writeJson,
} from '../store.js';
import type { Project } from '../types.js';

const r = Router();

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

r.get('/', async (_req, res) => {
  const ids = await listProjectIds();
  const projects = await Promise.all(
    ids.map(async (id) => {
      const p = await readJson<Project>(projectFile(id));
      if (!p) return null;
      const screens = await listScreens(id);
      const lastUpdated = screens.reduce((max, s) => (s.updatedAt > max ? s.updatedAt : max), p.createdAt);
      return { ...p, screenCount: screens.length, lastUpdated };
    }),
  );
  res.json(
    projects.filter((p) => p !== null).sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated)),
  );
});

r.post('/', async (req, res) => {
  const name = str(req.body?.name, 200);
  if (!name) throw new HttpError(400, '프로젝트 이름을 입력하세요');
  const project: Project = {
    id: newId(),
    name,
    description: str(req.body?.description, 2000),
    createdAt: new Date().toISOString(),
  };
  await writeJson(projectFile(project.id), project);
  res.status(201).json(project);
});

r.get('/:pid', async (req, res) => {
  res.json(await requireProject(req.params.pid));
});

/** PDF·Excel 내보내기용: 프로젝트의 모든 화면 전체 내용 */
r.get('/:pid/export', async (req, res) => {
  const project = await requireProject(req.params.pid);
  const [screens, flow] = await Promise.all([listScreens(project.id), readFlow(project.id)]);
  res.json({ project, screens: screens.sort(compareScreens), flow });
});

r.put('/:pid', async (req, res) => {
  const cur = await requireProject(req.params.pid);
  const name = str(req.body?.name, 200);
  if (!name) throw new HttpError(400, '프로젝트 이름을 입력하세요');
  const next: Project = { ...cur, name, description: str(req.body?.description, 2000) };
  await withFileLock(projectFile(cur.id), () => writeJson(projectFile(cur.id), next));
  res.json(next);
});

r.delete('/:pid', async (req, res) => {
  const cur = await requireProject(req.params.pid);
  await fs.rm(projectDir(cur.id), { recursive: true, force: true });
  res.status(204).end();
});

export default r;
