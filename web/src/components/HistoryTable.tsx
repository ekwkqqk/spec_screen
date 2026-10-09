import type { HistoryEntry } from '../types';
import { newId, today } from '../util';

interface Props {
  history: HistoryEntry[];
  /** 지정하면 표를 직접 수정할 수 있다 */
  onChange?: (history: HistoryEntry[]) => void;
  userName?: string;
  version?: string;
}

export default function HistoryTable({ history, onChange, userName = '', version = '' }: Props) {
  // 최신 이력이 위로 오게 보여 준다
  const rows = [...history].reverse();
  const update = (id: string, patch: Partial<HistoryEntry>) =>
    onChange?.(history.map((h) => (h.id === id ? { ...h, ...patch } : h)));

  return (
    <div>
      <table className="table history-table">
        <thead>
          <tr>
            <th className="col-ver">버전</th>
            <th className="col-date">일자</th>
            <th className="col-by">작성자</th>
            <th>변경 내용</th>
            {onChange && <th className="col-act" />}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={onChange ? 5 : 4} className="muted">
                변경 이력이 없습니다.
              </td>
            </tr>
          )}
          {rows.map((h) =>
            onChange ? (
              <tr key={h.id}>
                <td>
                  <input className="input small" value={h.version} onChange={(e) => update(h.id, { version: e.target.value })} />
                </td>
                <td>
                  <input className="input small" value={h.date} onChange={(e) => update(h.id, { date: e.target.value })} />
                </td>
                <td>
                  <input className="input small" value={h.by} onChange={(e) => update(h.id, { by: e.target.value })} />
                </td>
                <td>
                  <input className="input small" value={h.summary} onChange={(e) => update(h.id, { summary: e.target.value })} />
                </td>
                <td>
                  <button className="icon-btn danger" title="삭제" onClick={() => onChange(history.filter((x) => x.id !== h.id))}>
                    ✕
                  </button>
                </td>
              </tr>
            ) : (
              <tr key={h.id}>
                <td>{h.version}</td>
                <td>{h.date}</td>
                <td>{h.by}</td>
                <td className="pre">{h.summary}</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
      {onChange && (
        <button
          className="btn dashed"
          onClick={() => onChange([...history, { id: newId(), version, date: today(), by: userName, summary: '' }])}
        >
          + 이력 직접 추가
        </button>
      )}
    </div>
  );
}
