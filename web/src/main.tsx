import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserProvider } from './user';
import App from './App';
import ProjectList from './pages/ProjectList';
import ProjectDetail from './pages/ProjectDetail';
import ScreenView from './pages/ScreenView';
import ScreenEditor from './pages/ScreenEditor';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 5_000 } },
});

const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      { path: '/', element: <ProjectList /> },
      { path: '/p/:pid', element: <ProjectDetail /> },
      { path: '/p/:pid/flow', lazy: async () => ({ Component: (await import('./pages/FlowEditor')).default }) },
      { path: '/p/:pid/s/:sid', element: <ScreenView /> },
      { path: '/p/:pid/s/:sid/edit', element: <ScreenEditor /> },
      { path: '*', element: <div className="page">페이지를 찾을 수 없습니다.</div> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <RouterProvider router={router} />
      </UserProvider>
    </QueryClientProvider>
  </StrictMode>,
);
