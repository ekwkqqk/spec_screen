import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api, errorMessage, imageUrl } from '../api';
import ImageMarkerCanvas from '../components/ImageMarkerCanvas';
import ItemTable from '../components/ItemTable';
import HistoryTable from '../components/HistoryTable';
import ScreenInfoTable from '../components/ScreenInfoTable';

export default function ScreenView() {
  const { pid = '', sid = '' } = useParams();
  const project = useQuery({ queryKey: ['project', pid], queryFn: () => api.getProject(pid) });
  const q = useQuery({ queryKey: ['screen', pid, sid], queryFn: () => api.getScreen(pid, sid) });
  const [hoverId, setHoverId] = useState<string | null>(null);

  if (q.error) return <div className="page error">{errorMessage(q.error)}</div>;
  if (!q.data) return <div className="page muted">불러오는 중…</div>;
  const s = q.data;

  return (
    <div className="page wide">
      <nav className="crumbs">
        <Link to="/">프로젝트</Link> / <Link to={`/p/${pid}`}>{project.data?.name}</Link> / <span>{s.name}</span>
      </nav>
      <div className="page-head">
        <h1>
          {s.screenCode && <span className="mono code-tag">{s.screenCode}</span>} {s.name}
        </h1>
        <div className="actions">
          <Link className="btn" to={`/p/${pid}/flow`}>
            화면 흐름도
          </Link>
          <Link className="btn primary" to={`/p/${pid}/s/${sid}/edit`}>
            편집
          </Link>
        </div>
      </div>

      <ScreenInfoTable screen={s} />

      <div className="spec-layout">
        <section className="spec-image">
          {s.image ? (
            <ImageMarkerCanvas
              src={imageUrl(pid, s.image.file)}
              items={s.items}
              hoverId={hoverId}
              onHover={setHoverId}
              onMarkerClick={(id) => document.getElementById(`item-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })}
            />
          ) : (
            <div className="no-image muted">등록된 화면 이미지가 없습니다.</div>
          )}
        </section>
        <section className="spec-items">
          <h2>기능 설명</h2>
          <ItemTable items={s.items} hoverId={hoverId} onHover={setHoverId} />
        </section>
      </div>

      <section className="section">
        <h2>변경 이력</h2>
        <HistoryTable history={s.history} />
      </section>
    </div>
  );
}
