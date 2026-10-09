import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage, imageUrl } from '../api';
import Modal from '../components/Modal';
import { useUser } from '../user';
import { formatDateTime } from '../util';
import { exportExcel } from '../export/excel';

export default function ProjectDetail() {
  const { pid = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { name: userName } = useUser();
  const project = useQuery({ queryKey: ['project', pid], queryFn: () => api.getProject(pid) });
  const screens = useQuery({ queryKey: ['screens', pid], queryFn: () => api.listScreens(pid) });
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingProject, setEditingProject] = useState(false);
  const [form, setForm] = useState({ screenCode: '', name: '', menuPath: '' });
  const [projForm, setProjForm] = useState({ name: '', description: '' });
  const [exporting, setExporting] = useState(false);

  async function downloadExcel() {
    setExporting(true);
    try {
      await exportExcel(pid, await api.exportProject(pid));
    } catch (e) {
      alert(`Excel 내보내기 실패: ${errorMessage(e)}`);
    } finally {
      setExporting(false);
    }
  }

  const create = useMutation({
    mutationFn: () => api.createScreen(pid, { ...form, by: userName }),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ['screens', pid] });
      nav(`/p/${pid}/s/${s.id}/edit`);
    },
  });
  const remove = useMutation({
    mutationFn: (sid: string) => api.deleteScreen(pid, sid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['screens', pid] }),
    onError: (e) => alert(errorMessage(e)),
  });
  const saveProject = useMutation({
    mutationFn: () => api.updateProject(pid, projForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', pid] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      setEditingProject(false);
    },
  });
  const removeProject = useMutation({
    mutationFn: () => api.deleteProject(pid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      nav('/');
    },
    onError: (e) => alert(errorMessage(e)),
  });

  const keyword = search.trim().toLowerCase();
  const list = (screens.data ?? []).filter(
    (s) => !keyword || [s.screenCode, s.name, s.menuPath].some((v) => v.toLowerCase().includes(keyword)),
  );

  if (project.error) return <div className="page error">{errorMessage(project.error)}</div>;

  return (
    <div className="page">
      <nav className="crumbs">
        <Link to="/">프로젝트</Link> / <span>{project.data?.name}</span>
      </nav>
      <div className="page-head">
        <div>
          <h1>{project.data?.name}</h1>
          {project.data?.description && <p className="muted pre">{project.data.description}</p>}
        </div>
        <div className="actions">
          <button
            className="btn"
            onClick={() => {
              setProjForm({ name: project.data?.name ?? '', description: project.data?.description ?? '' });
              setEditingProject(true);
            }}
          >
            프로젝트 정보
          </button>
          <Link className="btn" to={`/p/${pid}/flow`}>
            화면 흐름도
          </Link>
          <button className="btn" disabled={exporting || !screens.data?.length} onClick={downloadExcel} title="전체 화면설계서를 Excel 파일로 저장">
            {exporting ? 'Excel 만드는 중…' : 'Excel'}
          </button>
          <button className="btn primary" onClick={() => setCreating(true)}>
            + 새 화면
          </button>
        </div>
      </div>

      <input
        className="input search"
        placeholder="화면ID, 화면명, 메뉴경로 검색"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {screens.isPending && <p className="muted">불러오는 중…</p>}
      {screens.data?.length === 0 && (
        <div className="empty">
          <p>아직 화면이 없습니다.</p>
          <button className="btn primary" onClick={() => setCreating(true)}>
            첫 화면 만들기
          </button>
        </div>
      )}

      {list.length > 0 && (
        <table className="table screen-list">
          <thead>
            <tr>
              <th className="col-thumb" />
              <th>화면ID</th>
              <th>화면명</th>
              <th>메뉴경로</th>
              <th className="col-ver">버전</th>
              <th className="col-num">항목</th>
              <th>최종 수정</th>
              <th className="col-act" />
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id} className="clickable" onClick={() => nav(`/p/${pid}/s/${s.id}`)}>
                <td className="col-thumb">
                  {s.image ? <img src={imageUrl(pid, s.image.file)} alt="" loading="lazy" /> : <div className="thumb-empty" />}
                </td>
                <td className="mono">{s.screenCode}</td>
                <td>
                  <strong>{s.name}</strong>
                </td>
                <td className="muted">{s.menuPath}</td>
                <td className="col-ver">{s.version}</td>
                <td className="col-num">{s.itemCount}</td>
                <td className="muted small-text">
                  {formatDateTime(s.updatedAt)}
                  {s.updatedBy && ` · ${s.updatedBy}`}
                </td>
                <td className="col-act" onClick={(e) => e.stopPropagation()}>
                  <Link className="btn small" to={`/p/${pid}/s/${s.id}/edit`}>
                    편집
                  </Link>
                  <button
                    className="btn small danger"
                    onClick={() => confirm(`'${s.name}' 화면을 삭제할까요? 되돌릴 수 없습니다.`) && remove.mutate(s.id)}
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {creating && (
        <Modal
          title="새 화면"
          onClose={() => setCreating(false)}
          footer={
            <>
              <button className="btn" onClick={() => setCreating(false)}>
                취소
              </button>
              <button className="btn primary" disabled={!form.name.trim() || create.isPending} onClick={() => create.mutate()}>
                만들고 편집하기
              </button>
            </>
          }
        >
          <label className="field">
            <span>화면ID</span>
            <input
              autoFocus
              className="input"
              placeholder="예: SCR-001"
              value={form.screenCode}
              onChange={(e) => setForm({ ...form, screenCode: e.target.value })}
            />
          </label>
          <label className="field">
            <span>화면명 *</span>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="field">
            <span>메뉴경로</span>
            <input
              className="input"
              placeholder="예: 회원관리 > 회원목록"
              value={form.menuPath}
              onChange={(e) => setForm({ ...form, menuPath: e.target.value })}
            />
          </label>
          {create.error && <p className="error">{errorMessage(create.error)}</p>}
        </Modal>
      )}

      {editingProject && (
        <Modal
          title="프로젝트 정보"
          onClose={() => setEditingProject(false)}
          footer={
            <>
              <button
                className="btn danger push-left"
                onClick={() =>
                  confirm(`'${project.data?.name}' 프로젝트와 모든 화면을 삭제할까요? 되돌릴 수 없습니다.`) &&
                  removeProject.mutate()
                }
              >
                프로젝트 삭제
              </button>
              <button className="btn" onClick={() => setEditingProject(false)}>
                취소
              </button>
              <button
                className="btn primary"
                disabled={!projForm.name.trim() || saveProject.isPending}
                onClick={() => saveProject.mutate()}
              >
                저장
              </button>
            </>
          }
        >
          <label className="field">
            <span>프로젝트명</span>
            <input className="input" value={projForm.name} onChange={(e) => setProjForm({ ...projForm, name: e.target.value })} />
          </label>
          <label className="field">
            <span>설명</span>
            <textarea
              className="input"
              rows={3}
              value={projForm.description}
              onChange={(e) => setProjForm({ ...projForm, description: e.target.value })}
            />
          </label>
          {saveProject.error && <p className="error">{errorMessage(saveProject.error)}</p>}
        </Modal>
      )}
    </div>
  );
}
