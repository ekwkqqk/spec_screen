import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../api';
import Modal from '../components/Modal';
import { formatDateTime } from '../util';

export default function ProjectList() {
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['projects'], queryFn: api.listProjects });
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const create = useMutation({
    mutationFn: () => api.createProject({ name, description }),
    onSuccess: (p) => nav(`/p/${p.id}`),
  });

  return (
    <div className="page">
      <div className="page-head">
        <h1>프로젝트</h1>
        <button className="btn primary" onClick={() => setCreating(true)}>
          + 새 프로젝트
        </button>
      </div>

      {q.isPending && <p className="muted">불러오는 중…</p>}
      {q.error && <p className="error">{errorMessage(q.error)}</p>}
      {q.data?.length === 0 && (
        <div className="empty">
          <p>아직 프로젝트가 없습니다.</p>
          <button className="btn primary" onClick={() => setCreating(true)}>
            첫 프로젝트 만들기
          </button>
        </div>
      )}

      <div className="card-grid">
        {q.data?.map((p) => (
          <Link key={p.id} to={`/p/${p.id}`} className="card project-card">
            <h3>{p.name}</h3>
            {p.description && <p className="muted clamp">{p.description}</p>}
            <div className="card-meta">
              <span>화면 {p.screenCount}개</span>
              <span>{formatDateTime(p.lastUpdated)}</span>
            </div>
          </Link>
        ))}
      </div>

      {creating && (
        <Modal
          title="새 프로젝트"
          onClose={() => setCreating(false)}
          footer={
            <>
              <button className="btn" onClick={() => setCreating(false)}>
                취소
              </button>
              <button className="btn primary" disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
                만들기
              </button>
            </>
          }
        >
          <label className="field">
            <span>프로젝트명</span>
            <input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>설명</span>
            <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          {create.error && <p className="error">{errorMessage(create.error)}</p>}
        </Modal>
      )}
    </div>
  );
}
