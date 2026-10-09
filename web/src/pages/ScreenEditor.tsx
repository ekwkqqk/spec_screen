import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api, errorMessage, imageUrl, type ConflictInfo } from '../api';
import ImageMarkerCanvas from '../components/ImageMarkerCanvas';
import ItemEditor from '../components/ItemEditor';
import HistoryTable from '../components/HistoryTable';
import Modal from '../components/Modal';
import { useUser } from '../user';
import {
  DEFAULT_MARKER_SIZE,
  MARKER_SIZE_MAX,
  MARKER_SIZE_MIN,
  clampMarkerSize,
  type Screen,
  type ScreenItem,
} from '../types';
import { bumpVersion, formatDateTime, imageSize, newId, today } from '../util';

const renumber = (items: ScreenItem[]) => items.map((it, i) => ({ ...it, no: i + 1 }));

export default function ScreenEditor() {
  const { pid = '', sid = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { name: userName } = useUser();
  const project = useQuery({ queryKey: ['project', pid], queryFn: () => api.getProject(pid) });

  // base: 마지막으로 서버에서 받은 내용, draft: 편집 중인 내용
  const [base, setBase] = useState<Screen | null>(null);
  const [draft, setDraft] = useState<Screen | null>(null);
  const [loadError, setLoadError] = useState('');
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [placingId, setPlacingId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<(ConflictInfo & { pending: Screen }) | null>(null);
  const [notice, setNotice] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const s = await api.getScreen(pid, sid);
      // 예전 데이터에 markerSize가 없어도 기본값으로 맞춰 dirty가 바로 켜지지 않게 한다
      const normalized = { ...s, markerSize: clampMarkerSize(s.markerSize) };
      setBase(normalized);
      setDraft(structuredClone(normalized));
      setLoadError('');
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  }, [pid, sid]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = !!draft && !!base && JSON.stringify(draft) !== JSON.stringify(base);

  // 저장하지 않고 떠나려 하면 경고한다
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);
  const blocker = useBlocker(dirty && !saving);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (confirm('저장하지 않은 변경 내용이 있습니다. 나갈까요?')) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  const patch = useCallback((p: Partial<Screen>) => setDraft((d) => d && { ...d, ...p }), []);
  const setItems = useCallback(
    (fn: (items: ScreenItem[]) => ScreenItem[]) => setDraft((d) => d && { ...d, items: renumber(fn(d.items)) }),
    [],
  );

  const uploadImage = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) return alert('이미지 파일만 올릴 수 있습니다.');
      setUploading(true);
      try {
        const [{ file: name }, size] = await Promise.all([api.uploadImage(pid, file), imageSize(file)]);
        patch({ image: { file: name, ...size } });
      } catch (e) {
        alert(`이미지 업로드 실패: ${errorMessage(e)}`);
      } finally {
        setUploading(false);
      }
    },
    [pid, patch],
  );

  // Ctrl+V로 캡처 이미지를 바로 붙여넣는다
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'));
      if (!file) return;
      e.preventDefault();
      void uploadImage(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [uploadImage]);

  useEffect(() => {
    if (!placingId) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPlacingId(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [placingId]);

  const addItem = (x: number | null, y: number | null) => {
    const item: ScreenItem = { id: newId(), no: 0, name: '', type: '버튼', description: '', remark: '', x, y };
    setItems((items) => [...items, item]);
    setFocusId(item.id);
  };

  const onImageClick = (x: number, y: number) => {
    if (placingId) {
      setItems((items) => items.map((it) => (it.id === placingId ? { ...it, x, y } : it)));
      setPlacingId(null);
    } else addItem(x, y);
  };

  const moveItem = (id: string, dir: -1 | 1) =>
    setItems((items) => {
      const i = items.findIndex((it) => it.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= items.length) return items;
      const next = [...items];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  async function doSave(next: Screen, force: boolean) {
    if (!base) return;
    setSaving(true);
    try {
      const saved = await api.saveScreen(pid, sid, { screen: next, baseUpdatedAt: base.updatedAt, force, by: userName });
      setBase(saved);
      setDraft(structuredClone(saved));
      setSaveOpen(false);
      setConflict(null);
      setNotice(`저장했습니다 (${formatDateTime(saved.updatedAt)})`);
      void qc.invalidateQueries({ queryKey: ['screen', pid, sid] });
      void qc.invalidateQueries({ queryKey: ['screens', pid] });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setSaveOpen(false);
        setConflict({ ...(e.body as unknown as ConflictInfo), pending: next });
      } else alert(`저장 실패: ${errorMessage(e)}`);
    } finally {
      setSaving(false);
    }
  }

  if (loadError) return <div className="page error">{loadError}</div>;
  if (!draft || !base) return <div className="page muted">불러오는 중…</div>;

  return (
    <div className="page wide editor">
      <nav className="crumbs">
        <Link to="/">프로젝트</Link> / <Link to={`/p/${pid}`}>{project.data?.name}</Link> /{' '}
        <Link to={`/p/${pid}/s/${sid}`}>{base.name}</Link> / <span>편집</span>
      </nav>

      <div className="page-head sticky-head">
        <h1>
          {draft.screenCode && <span className="mono code-tag">{draft.screenCode}</span>} {draft.name || '(화면명 없음)'}
          {dirty && <span className="dirty-dot" title="저장하지 않은 변경 있음" />}
        </h1>
        <div className="actions">
          {notice && !dirty && <span className="muted small-text">{notice}</span>}
          <button className="btn" onClick={() => nav(`/p/${pid}/s/${sid}`)}>
            보기
          </button>
          <button className="btn primary" disabled={!dirty || !draft.name.trim()} onClick={() => setSaveOpen(true)}>
            저장
          </button>
        </div>
      </div>

      <div className="spec-layout">
        <section
          className="spec-image"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) void uploadImage(f);
          }}
        >
          {draft.image ? (
            <>
              <div className="image-toolbar">
                <span className="hint muted small-text">
                  {placingId
                    ? '이미지에서 마커 위치를 클릭하세요 (Esc 취소)'
                    : '이미지 클릭: 마커 추가 · 마커 드래그: 이동 · Ctrl+V/드롭: 이미지 교체'}
                </span>
                <label className="marker-size-control" title="번호 마커 크기">
                  마커
                  <input
                    type="range"
                    min={MARKER_SIZE_MIN}
                    max={MARKER_SIZE_MAX}
                    step={1}
                    value={clampMarkerSize(draft.markerSize)}
                    onChange={(e) => patch({ markerSize: Number(e.target.value) })}
                  />
                  <span className="size-val">{clampMarkerSize(draft.markerSize)}</span>
                </label>
                <button className="btn small" onClick={() => fileInput.current?.click()}>
                  이미지 교체
                </button>
                <button
                  className="btn small danger"
                  onClick={() => confirm('화면 이미지를 제거할까요? (마커 위치는 유지됩니다)') && patch({ image: null })}
                >
                  제거
                </button>
              </div>
              <ImageMarkerCanvas
                src={imageUrl(pid, draft.image.file)}
                items={draft.items}
                markerSize={clampMarkerSize(draft.markerSize ?? DEFAULT_MARKER_SIZE)}
                hoverId={hoverId}
                onHover={setHoverId}
                editable
                placing={!!placingId}
                onImageClick={onImageClick}
                onMove={(id, x, y) => setItems((items) => items.map((it) => (it.id === id ? { ...it, x, y } : it)))}
                onMarkerClick={(id) => {
                  document.getElementById(`item-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }}
              />
            </>
          ) : (
            <button className="dropzone" onClick={() => fileInput.current?.click()} disabled={uploading}>
              {uploading ? (
                '업로드 중…'
              ) : (
                <>
                  <strong>화면 이미지 올리기</strong>
                  <span>파일을 끌어다 놓거나, 클릭해서 선택하거나,</span>
                  <span>캡처 후 Ctrl+V로 붙여넣으세요</span>
                </>
              )}
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadImage(f);
              e.target.value = '';
            }}
          />
        </section>

        <section className="spec-items">
          <h2>기본 정보</h2>
          <div className="info-form">
            <label className="field">
              <span>화면ID</span>
              <input className="input" value={draft.screenCode} onChange={(e) => patch({ screenCode: e.target.value })} />
            </label>
            <label className="field">
              <span>화면명 *</span>
              <input className="input" value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
            </label>
            <label className="field span-2">
              <span>메뉴경로</span>
              <input className="input" value={draft.menuPath} onChange={(e) => patch({ menuPath: e.target.value })} />
            </label>
            <label className="field">
              <span>작성자</span>
              <input className="input" value={draft.author} onChange={(e) => patch({ author: e.target.value })} />
            </label>
            <label className="field">
              <span>버전</span>
              <input className="input" value={draft.version} onChange={(e) => patch({ version: e.target.value })} />
            </label>
            <label className="field span-2">
              <span>화면 설명</span>
              <textarea
                className="input"
                rows={2}
                value={draft.description}
                onChange={(e) => patch({ description: e.target.value })}
              />
            </label>
          </div>

          <h2>기능 설명 ({draft.items.length})</h2>
          <ItemEditor
            items={draft.items}
            hoverId={hoverId}
            onHover={setHoverId}
            placingId={placingId}
            focusId={focusId}
            onChange={(id, p) => setItems((items) => items.map((it) => (it.id === id ? { ...it, ...p } : it)))}
            onMove={moveItem}
            onRemove={(id) => setItems((items) => items.filter((it) => it.id !== id))}
            onPlace={setPlacingId}
            onAdd={() => addItem(null, null)}
          />
        </section>
      </div>

      <section className="section">
        <h2>변경 이력</h2>
        <HistoryTable
          history={draft.history}
          onChange={(history) => patch({ history })}
          userName={userName}
          version={draft.version}
        />
      </section>

      {saveOpen && (
        <SaveDialog
          current={draft.version}
          busy={saving}
          onClose={() => setSaveOpen(false)}
          onSave={(version, summary, addHistory) =>
            doSave(
              {
                ...draft,
                version,
                history: addHistory
                  ? [...draft.history, { id: newId(), version, date: today(), by: userName, summary }]
                  : draft.history,
              },
              false,
            )
          }
        />
      )}

      {conflict && (
        <Modal
          title="다른 사람이 먼저 수정했습니다"
          onClose={() => setConflict(null)}
          footer={
            <>
              <button className="btn" onClick={() => setConflict(null)}>
                취소
              </button>
              <button
                className="btn"
                onClick={() => {
                  if (confirm('내가 편집한 내용을 버리고 최신 내용을 불러올까요?')) {
                    setConflict(null);
                    void load();
                  }
                }}
              >
                최신 내용 불러오기
              </button>
              <button className="btn danger" disabled={saving} onClick={() => doSave(conflict.pending, true)}>
                내 내용으로 덮어쓰기
              </button>
            </>
          }
        >
          <p>
            <strong>{conflict.updatedBy || '다른 사용자'}</strong>님이 {formatDateTime(conflict.updatedAt)}에 이 화면을
            저장했습니다.
          </p>
          <p className="muted">
            덮어쓰면 그 사람의 변경 내용이 사라집니다. 다른 탭에서 화면을 열어 최신 내용을 확인한 뒤 결정하세요.
          </p>
          <a className="link" href={`/p/${pid}/s/${sid}`} target="_blank" rel="noreferrer">
            최신 내용 새 탭에서 보기 ↗
          </a>
        </Modal>
      )}
    </div>
  );
}

function SaveDialog({
  current,
  busy,
  onClose,
  onSave,
}: {
  current: string;
  busy: boolean;
  onClose: () => void;
  onSave: (version: string, summary: string, addHistory: boolean) => void;
}) {
  const [addHistory, setAddHistory] = useState(true);
  const [version, setVersion] = useState(() => bumpVersion(current));
  const [summary, setSummary] = useState('');

  return (
    <Modal
      title="저장"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            취소
          </button>
          <button
            className="btn primary"
            disabled={busy || (addHistory && !summary.trim())}
            onClick={() => onSave(addHistory ? version.trim() : current, summary.trim(), addHistory)}
          >
            저장
          </button>
        </>
      }
    >
      <label className="check">
        <input type="checkbox" checked={addHistory} onChange={(e) => setAddHistory(e.target.checked)} />
        변경 이력에 기록하고 버전 올리기
      </label>
      {addHistory ? (
        <>
          <label className="field">
            <span>버전 (현재 {current || '-'})</span>
            <input className="input" value={version} onChange={(e) => setVersion(e.target.value)} />
          </label>
          <label className="field">
            <span>변경 내용 *</span>
            <textarea
              autoFocus
              className="input"
              rows={3}
              placeholder="예: 검색 조건에 기간 추가"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </label>
        </>
      ) : (
        <p className="muted">이력 없이 현재 버전({current || '-'}) 그대로 저장합니다. 오타 수정 등 작은 변경에 사용하세요.</p>
      )}
    </Modal>
  );
}
