import type { ScreenItem } from '../types';

interface Props {
  items: ScreenItem[];
  hoverId: string | null;
  onHover: (id: string | null) => void;
}

/** 조회 화면의 번호별 기능 설명표 */
export default function ItemTable({ items, hoverId, onHover }: Props) {
  if (items.length === 0) return <p className="muted">등록된 항목이 없습니다.</p>;
  return (
    <table className="table items-table">
      <thead>
        <tr>
          <th className="col-no">No</th>
          <th>항목명</th>
          <th className="col-type">유형</th>
          <th>설명</th>
          <th className="col-remark">비고</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it, i) => (
          <tr
            key={it.id}
            id={`item-${it.id}`}
            className={hoverId === it.id ? 'active' : ''}
            onMouseEnter={() => onHover(it.id)}
            onMouseLeave={() => onHover(null)}
          >
            <td className="col-no">
              <span className="no-badge">{i + 1}</span>
            </td>
            <td>{it.name}</td>
            <td className="col-type">{it.type}</td>
            <td className="pre">{it.description}</td>
            <td className="col-remark pre">{it.remark}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
