import type { Flow, Project, ProjectExport, ProjectSummary, Screen, ScreenSummary } from './types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body: Record<string, unknown>,
  ) {
    super(message);
  }
}

/** 409 충돌 응답에 담겨 오는 정보 */
export interface ConflictInfo {
  updatedAt: string;
  updatedBy: string;
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  const res = await fetch(url, init);
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? `요청 실패 (${res.status})`, data);
  return data as T;
}

const p = (pid: string) => `/api/projects/${encodeURIComponent(pid)}`;

export const imageUrl = (pid: string, file: string) => `${p(pid)}/images/${file}`;

export const api = {
  listProjects: () => request<ProjectSummary[]>('GET', '/api/projects'),
  createProject: (data: { name: string; description: string }) => request<Project>('POST', '/api/projects', data),
  getProject: (pid: string) => request<Project>('GET', p(pid)),
  exportProject: (pid: string) => request<ProjectExport>('GET', `${p(pid)}/export`),
  updateProject: (pid: string, data: { name: string; description: string }) => request<Project>('PUT', p(pid), data),
  deleteProject: (pid: string) => request<void>('DELETE', p(pid)),

  listScreens: (pid: string) => request<ScreenSummary[]>('GET', `${p(pid)}/screens`),
  createScreen: (pid: string, data: { screenCode: string; name: string; menuPath: string; by: string }) =>
    request<Screen>('POST', `${p(pid)}/screens`, data),
  getScreen: (pid: string, sid: string) => request<Screen>('GET', `${p(pid)}/screens/${sid}`),
  saveScreen: (pid: string, sid: string, data: { screen: Screen; baseUpdatedAt: string; force: boolean; by: string }) =>
    request<Screen>('PUT', `${p(pid)}/screens/${sid}`, data),
  deleteScreen: (pid: string, sid: string) => request<void>('DELETE', `${p(pid)}/screens/${sid}`),

  uploadImage: (pid: string, file: Blob) => {
    const form = new FormData();
    form.append('file', file);
    return request<{ file: string }>('POST', `${p(pid)}/images`, form);
  },

  getFlow: (pid: string) => request<Flow>('GET', `${p(pid)}/flow`),
  saveFlow: (
    pid: string,
    data: { flow: Pick<Flow, 'nodes' | 'edges'>; baseUpdatedAt: string | null; force: boolean; by: string },
  ) => request<Flow>('PUT', `${p(pid)}/flow`, data),
};

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
