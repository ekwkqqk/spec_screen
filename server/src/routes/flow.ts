import { Router } from 'express';
import { HttpError, flowFile, isId, newId, readFlow, requireProject, withFileLock, writeJson } from '../store.js';
import type { Flow, FlowEdge } from '../types.js';

const r = Router({ mergeParams: true });

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {});
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0);
const dim = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(2000, Math.max(50, Math.round(v))) : null);
const handle = (v: unknown) => (typeof v === 'string' && /^[a-z]{1,10}$/.test(v) ? v : null);

function sanitizeFlow(input: unknown): Pick<Flow, 'nodes' | 'edges'> {
  const i = obj(input);
  const nodes: Flow['nodes'] = {};
  for (const [key, v] of Object.entries(obj(i.nodes))) {
    if (!isId(key)) continue;
    const o = obj(v);
    const node: Flow['nodes'][string] = { x: num(o.x), y: num(o.y) };
    const w = dim(o.w);
    const h = dim(o.h);
    if (w) node.w = w;
    if (h) node.h = h;
    nodes[key] = node;
  }
  const edges: FlowEdge[] = [];
  for (const v of Array.isArray(i.edges) ? i.edges.slice(0, 5000) : []) {
    const e = obj(v);
    if (!isId(e.from) || !isId(e.to)) continue;
    edges.push({
      id: isId(e.id) ? e.id : newId(),
      from: e.from,
      to: e.to,
      label: str(e.label, 200),
      sourceHandle: handle(e.sourceHandle),
      targetHandle: handle(e.targetHandle),
    });
  }
  return { nodes, edges };
}

r.get('/', async (req, res) => {
  const project = await requireProject((req.params as Obj).pid);
  res.json(await readFlow(project.id));
});

r.put('/', async (req, res) => {
  const project = await requireProject((req.params as Obj).pid);
  const body = obj(req.body);
  const file = flowFile(project.id);
  const saved = await withFileLock(file, async () => {
    const cur = await readFlow(project.id);
    if (body.force !== true && (body.baseUpdatedAt ?? null) !== cur.updatedAt) {
      throw new HttpError(409, '다른 사용자가 먼저 수정했습니다', {
        updatedAt: cur.updatedAt,
        updatedBy: cur.updatedBy,
      });
    }
    const next: Flow = {
      ...sanitizeFlow(body.flow),
      updatedAt: new Date().toISOString(),
      updatedBy: str(body.by, 100),
    };
    await writeJson(file, next);
    return next;
  });
  res.json(saved);
});

export default r;
