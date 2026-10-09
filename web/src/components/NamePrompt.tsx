import { useState } from 'react';
import { useUser } from '../user';
import Modal from './Modal';

/** 로그인 대신 이름만 받아 작성자·변경이력에 사용한다 */
export default function NamePrompt({ onClose }: { onClose?: () => void }) {
  const { name, setName } = useUser();
  const [value, setValue] = useState(name);

  const submit = () => {
    if (!value.trim()) return;
    setName(value.trim());
    onClose?.();
  };

  return (
    <Modal
      title={name ? '이름 변경' : '이름을 입력하세요'}
      onClose={onClose}
      footer={
        <>
          {onClose && (
            <button className="btn" onClick={onClose}>
              취소
            </button>
          )}
          <button className="btn primary" onClick={submit} disabled={!value.trim()}>
            확인
          </button>
        </>
      }
    >
      <p className="muted">작성자와 변경 이력에 표시됩니다. 이 브라우저에 기억됩니다.</p>
      <input
        autoFocus
        className="input"
        value={value}
        placeholder="예: 홍길동"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
    </Modal>
  );
}
