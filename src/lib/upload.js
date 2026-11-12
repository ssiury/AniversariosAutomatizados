import multer from 'multer';

/** Upload em memória (a imagem é normalizada pelo sharp antes de ir para o disco). */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, arquivo, cb) => cb(null, /^image\/(jpeg|png|webp|heic|heif|gif)$/.test(arquivo.mimetype)),
});
