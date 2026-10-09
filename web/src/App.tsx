import { useState } from 'react';
import { Link, Outlet } from 'react-router';
import { useUser } from './user';
import NamePrompt from './components/NamePrompt';

export default function App() {
  const { name } = useUser();
  const [editingName, setEditingName] = useState(false);

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">
          화면설계서
        </Link>
        <button className="user-chip" onClick={() => setEditingName(true)} title="이름 변경">
          {name || '이름 미설정'}
        </button>
      </header>
      <main>
        <Outlet />
      </main>
      {(!name || editingName) && <NamePrompt onClose={name ? () => setEditingName(false) : undefined} />}
    </>
  );
}
