import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

const KEY = 'spec_screen.userName';

function load(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

interface UserCtx {
  name: string;
  setName: (name: string) => void;
}

const Ctx = createContext<UserCtx>({ name: '', setName: () => {} });

export function UserProvider({ children }: { children: ReactNode }) {
  const [name, setNameState] = useState(load);
  const setName = useCallback((n: string) => {
    setNameState(n);
    try {
      localStorage.setItem(KEY, n);
    } catch {
      // 저장소를 못 쓰는 환경이면 이번 세션 동안만 기억한다
    }
  }, []);
  return <Ctx.Provider value={{ name, setName }}>{children}</Ctx.Provider>;
}

export const useUser = () => useContext(Ctx);
