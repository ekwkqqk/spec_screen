import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Background,
  ConnectionMode,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  NodeResizer,
  Position,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ApiError, api, errorMessage, imageUrl, type ConflictInfo } from '../api';
import { useUser } from '../user';
import type { Flow, ScreenSummary } from '../types';
import { formatDateTime, newId } from '../util';

type ScreenNode = Node<{ screen: ScreenSummary; pid: string }, 'screen'>;

const DEFAULT_WIDTH = 200;
const MIN_WIDTH = 120;
const MAX_SIZE = 2000;
const SIZE_PRESETS = [
  { label: '작게', width: 140 },
  { label: '보통', width: DEFAULT_WIDTH },
  { label: '크게', width: 360 },
];

function ScreenNodeView({ data, selected, height }: NodeProps<ScreenNode>) {
  const { screen, pid } = data;
  return (
    // 높이를 직접 조절한 노드는 이미지가 남은 공간을 채우고, 아니면 너비에 비례한다
    <div className={`flow-node${height ? ' fixed-height' : ''}`}>
      <NodeResizer isVisible={selected} minWidth={MIN_WIDTH} minHeight={100} maxWidth={MAX_SIZE} maxHeight={MAX_SIZE} />
      {screen.image ? <img src={imageUrl(pid, screen.image.file)} alt="" draggable={false} /> : <div className="thumb-empty" />}
      <div className="flow-node-label">
        {screen.screenCode && <span className="mono">{screen.screenCode}</span>}
        <strong>{screen.name}</strong>
      </div>
      {/* 네 방향 모두에서 연결할 수 있게 한다 (ConnectionMode.Loose) */}
      <Handle type="source" position={Position.Top} id="t" />
      <Handle type="source" position={Position.Right} id="r" />
      <Handle type="source" position={Position.Bottom} id="b" />
      <Handle type="source" position={Position.Left} id="l" />
    </div>
  );
}

const nodeTypes = { screen: ScreenNodeView };
const edgeDefaults = { markerEnd: { type: MarkerType.ArrowClosed }, type: 'smoothstep' } as const;

function toEdge(e: Flow['edges'][number]): Edge {
  return {
    id: e.id,
    source: e.from,
    target: e.to,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    label: e.label || undefined,
    ...edgeDefaults,
  };
}

function serialize(nodes: Node[], edges: Edge[]): Pick<Flow, 'nodes' | 'edges'> {
  return {
    nodes: Object.fromEntries(
      nodes.map((n) => [
        n.id,
        {
          x: Math.round(n.position.x),
          y: Math.round(n.position.y),
          w: n.width == null ? undefined : Math.round(n.width),
          h: n.height == null ? undefined : Math.round(n.height),
        },
      ]),
    ),
    edges: edges.map((e) => ({
      id: e.id,
      from: e.source,
      to: e.target,
      label: typeof e.label === 'string' ? e.label : '',
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
    })),
  };
}

export default function FlowEditor() {
  const { pid = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { name: userName } = useUser();
  const project = useQuery({ queryKey: ['project', pid], queryFn: () => api.getProject(pid) });

  const [nodes, setNodes, onNodesChange] = useNodesState<ScreenNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [base, setBase] = useState<{ updatedAt: string | null; snapshot: string } | null>(null);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const [screens, flow] = await Promise.all([api.listScreens(pid), api.getFlow(pid)]);
      const ids = new Set(screens.map((s) => s.id));
      const nextNodes: ScreenNode[] = screens.map((s, i) => {
        const saved = flow.nodes[s.id];
        return {
          id: s.id,
          type: 'screen',
          position: saved ? { x: saved.x, y: saved.y } : { x: (i % 4) * 280, y: Math.floor(i / 4) * 240 },
          width: saved?.w ?? DEFAULT_WIDTH,
          height: saved?.h,
          data: { screen: s, pid },
          deletable: false,
        };
      });
      const nextEdges = flow.edges.filter((e) => ids.has(e.from) && ids.has(e.to)).map(toEdge);
      setNodes(nextNodes);
      setEdges(nextEdges);
      setBase({ updatedAt: flow.updatedAt, snapshot: JSON.stringify(serialize(nextNodes, nextEdges)) });
      setLoadError('');
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  }, [pid, setNodes, setEdges]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = useMemo(() => serialize(nodes, edges), [nodes, edges]);
  const dirty = !!base && JSON.stringify(current) !== base.snapshot;

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);
  const blocker = useBlocker(dirty);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (confirm('저장하지 않은 흐름도 변경이 있습니다. 나갈까요?')) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  const onConnect = useCallback(
    (c: Connection) => {
      if (c.source === c.target) return;
      setEdges((eds) => addEdge({ ...c, id: newId(), ...edgeDefaults }, eds));
    },
    [setEdges],
  );

  // 선택한 화면, 선택이 없으면 모든 화면의 크기를 바꾼다. 높이는 너비에 맞춰 자동으로 정해진다
  const applySize = (width: number) =>
    setNodes((nds) => {
      const anySelected = nds.some((n) => n.selected);
      return nds.map((n) => (!anySelected || n.selected ? { ...n, width, height: undefined } : n));
    });
  const selectedCount = nodes.filter((n) => n.selected).length;

  async function save(force = false) {
    if (!base) return;
    setSaving(true);
    try {
      const saved = await api.saveFlow(pid, { flow: current, baseUpdatedAt: base.updatedAt, force, by: userName });
      setBase({ updatedAt: saved.updatedAt, snapshot: JSON.stringify(current) });
      setNotice(`저장했습니다 (${formatDateTime(saved.updatedAt)})`);
      void qc.invalidateQueries({ queryKey: ['flow', pid] });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const info = e.body as unknown as ConflictInfo;
        const who = info.updatedBy || '다른 사용자';
        if (confirm(`${who}님이 ${formatDateTime(info.updatedAt)}에 흐름도를 먼저 저장했습니다.\n\n[확인] 내 흐름도로 덮어쓰기\n[취소] 최신 흐름도 불러오기 (내 변경 버림)`)) {
          setSaving(false);
          return save(true);
        }
        await load();
      } else alert(`저장 실패: ${errorMessage(e)}`);
    } finally {
      setSaving(false);
    }
  }

  if (loadError) return <div className="page error">{loadError}</div>;

  return (
    <div className="flow-page">
      <div className="flow-head">
        <nav className="crumbs">
          <Link to="/">프로젝트</Link> / <Link to={`/p/${pid}`}>{project.data?.name}</Link> / <span>화면 흐름도</span>
        </nav>
        <span className="muted small-text hint">
          점을 끌어 화면 연결 · 화면 선택 후 모서리 드래그: 크기 조절 · 연결선 더블클릭: 라벨 · Delete: 연결선 삭제 · 화면
          더블클릭: 열기
        </span>
        <div className="size-presets" title={selectedCount ? '선택한 화면의 크기 변경' : '모든 화면의 크기 변경'}>
          <span className="muted small-text">{selectedCount ? `선택 ${selectedCount}개` : '전체'} 크기</span>
          {SIZE_PRESETS.map((p) => (
            <button key={p.label} className="btn small" onClick={() => applySize(p.width)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="actions">
          {notice && !dirty && <span className="muted small-text">{notice}</span>}
          {dirty && <span className="dirty-dot" title="저장하지 않은 변경 있음" />}
          <button className="btn primary" disabled={!dirty || saving} onClick={() => save()}>
            저장
          </button>
        </div>
      </div>
      <div className="flow-canvas">
        {base && nodes.length === 0 && <div className="flow-empty muted">프로젝트에 화면을 먼저 추가하세요.</div>}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          connectionMode={ConnectionMode.Loose}
          deleteKeyCode={['Delete', 'Backspace']}
          onNodeDoubleClick={(_, n) => nav(`/p/${pid}/s/${n.id}`)}
          onEdgeDoubleClick={(_, edge) => {
            const label = prompt('연결선 라벨 (예: 저장 버튼 클릭)', typeof edge.label === 'string' ? edge.label : '');
            if (label === null) return;
            setEdges((eds) => eds.map((e) => (e.id === edge.id ? { ...e, label: label.trim() || undefined } : e)));
          }}
          fitView
          minZoom={0.1}
        >
          <Background gap={16} />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>
    </div>
  );
}
