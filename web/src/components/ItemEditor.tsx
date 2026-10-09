import { ITEM_TYPES, type ScreenItem } from '../types';

interface Props {
  items: ScreenItem[];
  hoverId: string | null;
  onHover: (id: string | null) => void;
  placingId: string | null;
  focusId: string | null;
  onChange: (id: string, patch: Partial<ScreenItem>) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
  onPlace: (id: string | null) => void;
  onAdd: () => void;
}

/** 편집 화면의 번호별 기능 설명 목록 */
export default function ItemEditor(p: Props) {
  return (
    <div className="item-editor">
      {p.items.length === 0 && (
        <p className="muted empty-hint">이미지를 클릭하면 번호 마커와 설명 행이 함께 추가됩니다.</p>
      )}
      {p.items.map((it, i) => (
        <div
          key={it.id}
          id={`item-${it.id}`}
          className={`item-card${p.hoverId === it.id ? ' active' : ''}`}
          onMouseEnter={() => p.onHover(it.id)}
          onMouseLeave={() => p.onHover(null)}
        >
          <div className="item-row">
            <span className={`no-badge${it.x == null ? ' unplaced' : ''}`} title={it.x == null ? '마커 위치 없음' : ''}>
              {i + 1}
            </span>
            <input
              className="input"
              placeholder="항목명"
              value={it.name}
              autoFocus={p.focusId === it.id}
              onChange={(e) => p.onChange(it.id, { name: e.target.value })}
            />
            <select className="input type-select" value={it.type} onChange={(e) => p.onChange(it.id, { type: e.target.value })}>
              {!ITEM_TYPES.includes(it.type) && <option value={it.type}>{it.type || '(유형)'}</option>}
              {ITEM_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <div className="item-actions">
              <button
                className={`icon-btn${p.placingId === it.id ? ' on' : ''}`}
                title={p.placingId === it.id ? '위치 지정 취소' : '이미지에서 마커 위치 지정'}
                onClick={() => p.onPlace(p.placingId === it.id ? null : it.id)}
              >
                ⌖
              </button>
              <button className="icon-btn" title="위로" disabled={i === 0} onClick={() => p.onMove(it.id, -1)}>
                ↑
              </button>
              <button className="icon-btn" title="아래로" disabled={i === p.items.length - 1} onClick={() => p.onMove(it.id, 1)}>
                ↓
              </button>
              <button className="icon-btn danger" title="삭제" onClick={() => p.onRemove(it.id)}>
                ✕
              </button>
            </div>
          </div>
          <textarea
            className="input"
            rows={2}
            placeholder="기능 설명 (동작, 유효성 검사, 이동 화면 등)"
            value={it.description}
            onChange={(e) => p.onChange(it.id, { description: e.target.value })}
          />
          <input
            className="input small"
            placeholder="비고"
            value={it.remark}
            onChange={(e) => p.onChange(it.id, { remark: e.target.value })}
          />
        </div>
      ))}
      <button className="btn dashed" onClick={p.onAdd}>
        + 행 추가 (마커 없이)
      </button>
    </div>
  );
}
