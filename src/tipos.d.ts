// Propriedades que os middlewares `carregar` das rotas penduram na requisição.
declare namespace Express {
  interface Request {
    membro?: import('./compartilhado/tipos.js').Membro;
    template?: import('./compartilhado/tipos.js').Template;
  }
}
