import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express, { type ErrorRequestHandler } from 'express';
import multer from 'multer';
import { DATA_DIR, HttpError } from './store.js';
import projects from './routes/projects.js';
import screens from './routes/screens.js';
import images from './routes/images.js';
import flow from './routes/flow.js';

const app = express();
app.use(express.json({ limit: '5mb' }));

app.use('/api/projects', projects);
app.use('/api/projects/:pid/screens', screens);
app.use('/api/projects/:pid/images', images);
app.use('/api/projects/:pid/flow', flow);
app.use('/api', (_req, res) => {
  res.status(404).json({ error: '없는 API입니다' });
});

// 빌드된 프론트엔드(web/dist)가 있으면 같은 포트에서 함께 서빙한다
const webDist = path.resolve(import.meta.dirname, '..', '..', 'web', 'dist');
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.use((req, res, next) => {
    if (req.method === 'GET') res.sendFile(path.join(webDist, 'index.html'));
    else next();
  });
}

const onError: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, ...err.body });
  } else if (err instanceof multer.MulterError) {
    res.status(400).json({
      error: err.code === 'LIMIT_FILE_SIZE' ? '이미지는 20MB 이하만 올릴 수 있습니다' : err.message,
    });
  } else if (typeof err?.status === 'number' && err.status < 500) {
    res.status(err.status).json({ error: err.message });
  } else {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
};
app.use(onError);

const PORT = Number(process.env.PORT ?? 4300);
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`화면설계서 서버 실행 중: http://localhost:${PORT}`);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal) console.log(`  팀원 접속 주소: http://${a.address}:${PORT}`);
    }
  }
  console.log(`  데이터 폴더: ${DATA_DIR}`);
});
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`${PORT}번 포트를 다른 프로그램이 사용 중입니다. PORT 환경변수로 다른 포트를 지정하세요.`);
  } else console.error(err);
  process.exit(1);
});
