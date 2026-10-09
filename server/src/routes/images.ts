import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { HttpError, IMAGE_FILE_RE, imagesDir, newId, requireProject } from '../store.js';

const r = Router({ mergeParams: true });

const EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = imagesDir((req.params as Record<string, string>).pid);
      fs.mkdir(dir, { recursive: true }).then(
        () => cb(null, dir),
        (e: Error) => cb(e, dir),
      );
    },
    filename: (_req, file, cb) => cb(null, newId() + EXT[file.mimetype]),
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype in EXT),
});

r.post(
  '/',
  async (req, _res, next) => {
    await requireProject((req.params as Record<string, string>).pid);
    next();
  },
  upload.single('file'),
  (req, res) => {
    if (!req.file) throw new HttpError(400, '이미지 파일(png, jpg, gif, webp)만 올릴 수 있습니다');
    res.status(201).json({ file: req.file.filename });
  },
);

r.get('/:file', async (req, res) => {
  const project = await requireProject((req.params as Record<string, string>).pid);
  const file = req.params.file;
  if (!IMAGE_FILE_RE.test(file)) throw new HttpError(400, '잘못된 파일명입니다');
  // 파일명이 업로드마다 새로 만들어지므로 오래 캐시해도 된다
  res.sendFile(path.join(imagesDir(project.id), file), { maxAge: '365d', immutable: true });
});

export default r;
