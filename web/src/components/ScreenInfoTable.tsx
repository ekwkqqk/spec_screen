import type { Screen } from '../types';
import { formatDateTime } from '../util';

/** 화면설계서 상단의 기본 정보 표 (조회·인쇄 공용) */
export default function ScreenInfoTable({ screen: s }: { screen: Screen }) {
  return (
    <table className="table info-table">
      <tbody>
        <tr>
          <th>화면ID</th>
          <td className="mono">{s.screenCode}</td>
          <th>화면명</th>
          <td>{s.name}</td>
          <th>메뉴경로</th>
          <td>{s.menuPath}</td>
        </tr>
        <tr>
          <th>작성자</th>
          <td>{s.author}</td>
          <th>버전</th>
          <td>{s.version}</td>
          <th>최종 수정</th>
          <td>
            {formatDateTime(s.updatedAt)} {s.updatedBy && `(${s.updatedBy})`}
          </td>
        </tr>
        {s.description && (
          <tr>
            <th>화면 설명</th>
            <td colSpan={5} className="pre">
              {s.description}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
