-- Os três templates de arte. INSERT OR IGNORE: em bancos que já os têm, não altera nada.
INSERT OR IGNORE INTO template (tipo, nome, cor_destaque, mensagem_arte, legenda) VALUES
  (
    'masculino', 'Masculino', '#1565c0',
    'Que Deus abençoe
seu novo ano de vida!',
    '🎉 Hoje é aniversário do *{nome}*!
Parabéns pelos {idade} anos. Que Deus te abençoe grandemente!

— {ministerio}'
  ),
  (
    'feminino', 'Feminino', '#c2185b',
    'Que Deus abençoe
seu novo ano de vida!',
    '🎉 Hoje é aniversário da *{nome}*!
Parabéns pelos {idade} anos. Que Deus te abençoe grandemente!

— {ministerio}'
  ),
  (
    'infantil', 'Infantil', '#ef6c00',
    'Hoje é dia de festa!
Deus te ama muito!',
    '🎈 Hoje é dia de festa! *{nome}* está fazendo {idade} aninhos!
Que Jesus encha sua vida de alegria!

— {ministerio}'
  );
