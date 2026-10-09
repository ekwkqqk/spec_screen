import fs from 'node:fs/promises';
import path from 'node:path';
import type { Flow, Project, Screen } from './types.js';

export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? path.join(import.meta.dirname, '..', '..', 'data'));
export const PROJECTS_DIR = path.join(DATA_DIR, 'projects');

export class HttpError extends Error {
  constructor(public status: number, message: string, public body?: Record<string, unknown>) {
    super(message);
  }
}

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
export const IMAGE_FILE_RE = /^[A-Za-z0-9_-]{1,64}\.(png|jpg|gif|webp)$/;

/** 경로 조작을 막기 위해 URL로 들어온 ID를 검증한다 */
export function assertId(id: unknown): string {
  if (typeof id !== 'string' || !ID_RE.test(id)) throw new HttpError(400, '잘못된 ID입니다');
  return id;
}

export function isId(id: unknown): id is string {
  return typeof id === 'string' && ID_RE.test(id);
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const projectDir = (pid: string) => path.join(PROJECTS_DIR, pid);
export const projectFile = (pid: string) => path.join(projectDir(pid), 'project.json');
export const flowFile = (pid: string) => path.join(projectDir(pid), 'flow.json');
export const screensDir = (pid: string) => path.join(projectDir(pid), 'screens');
export const screenFile = (pid: string, sid: string) => path.join(screensDir(pid), `${sid}.json`);
export const imagesDir = (pid: string) => path.join(projectDir(pid), 'images');

export async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

/** 임시 파일에 쓴 뒤 rename해서, 쓰는 도중 서버가 꺼져도 파일이 깨지지 않게 한다 */
export async function writeJson(file: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${newId()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  // Windows에서는 백신 등이 파일을 잠깐 잡고 있으면 rename이 EPERM으로 실패할 수 있어 몇 번 재시도한다
  for (let attempt = 0; ; attempt++) {
    try {
      await fs.rename(tmp, file);
      return;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (attempt >= 5 || (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES')) {
        await fs.rm(tmp, { force: true });
        throw e;
      }
      await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
    }
  }
}

const queues = new Map<string, Promise<unknown>>();

/** 같은 파일에 대한 읽기-검사-쓰기를 한 번에 하나씩만 실행한다 */
export function withFileLock<T>(file: string, fn: () => Promise<T>): Promise<T> {
  const prev = queues.get(file) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  const tail = next.catch(() => {});
  queues.set(file, tail);
  void tail.then(() => {
    if (queues.get(file) === tail) queues.delete(file);
  });
  return next;
}

export async function requireProject(pid: unknown): Promise<Project> {
  const project = await readJson<Project>(projectFile(assertId(pid)));
  if (!project) throw new HttpError(404, '프로젝트를 찾을 수 없습니다');
  return project;
}

export async function listProjectIds(): Promise<string[]> {
  await fs.mkdir(PROJECTS_DIR, { recursive: true });
  const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory() && isId(e.name)).map((e) => e.name);
}

export async function listScreens(pid: string): Promise<Screen[]> {
  let files: string[];
  try {
    files = await fs.readdir(screensDir(pid));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }
  const screens = await Promise.all(
    files
      .filter((f) => f.endsWith('.json') && isId(f.slice(0, -5)))
      .map((f) => readJson<Screen>(path.join(screensDir(pid), f))),
  );
  return screens.filter((s): s is Screen => s !== null);
}

/** 화면ID 순(숫자는 자연 정렬), 같으면 화면명 순 */
export function compareScreens(a: Pick<Screen, 'screenCode' | 'name'>, b: Pick<Screen, 'screenCode' | 'name'>): number {
  return a.screenCode.localeCompare(b.screenCode, 'ko', { numeric: true }) || a.name.localeCompare(b.name, 'ko');
}

export function emptyFlow(): Flow {
  return { nodes: {}, edges: [], updatedAt: null, updatedBy: '' };
}

export async function readFlow(pid: string): Promise<Flow> {
  return (await readJson<Flow>(flowFile(pid))) ?? emptyFlow();
}
