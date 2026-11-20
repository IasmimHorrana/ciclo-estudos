-- Teste das regras do Ciclo de Estudos na nuvem (rodar no SQL Editor depois da migração 0001).
-- Tudo acontece dentro de uma transação que é DESFEITA no fim (rollback): não sobra nenhum dado nem usuário.
-- Cria dois usuários de mentira (A e B) só durante o teste. Se alguma regra falhar, para com "FALHOU: ...".

begin;

insert into auth.users (id, email, aud, role)
values ('00000000-0000-4000-8000-0000000000a1', 'teste-a@ciclo.invalid', 'authenticated', 'authenticated'),
       ('00000000-0000-4000-8000-0000000000b1', 'teste-b@ciclo.invalid', 'authenticated', 'authenticated');

-- ===== usuário A =====
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';

insert into public.ciclo_registros (colecao, id, dados, editado_em, esquema_versao)
values ('notas', 'n1', '{"t":"A"}', 1000, 7);

do $$
declare
  ok boolean;
  n integer;
begin
  -- edição mais velha não sobrescreve
  insert into public.ciclo_registros (colecao, id, dados, editado_em, esquema_versao)
  values ('notas', 'n1', '{"t":"velha"}', 500, 7)
  on conflict (user_id, colecao, id) do update set dados = excluded.dados, editado_em = excluded.editado_em, esquema_versao = excluded.esquema_versao;
  if (select dados ->> 't' from public.ciclo_registros where colecao = 'notas' and id = 'n1') <> 'A' then
    raise exception 'FALHOU: edição mais velha sobrescreveu a mais nova';
  end if;

  -- edição mais nova sobrescreve
  insert into public.ciclo_registros (colecao, id, dados, editado_em, esquema_versao)
  values ('notas', 'n1', '{"t":"nova"}', 2000, 7)
  on conflict (user_id, colecao, id) do update set dados = excluded.dados, editado_em = excluded.editado_em, esquema_versao = excluded.esquema_versao;
  if (select dados ->> 't' from public.ciclo_registros where colecao = 'notas' and id = 'n1') <> 'nova' then
    raise exception 'FALHOU: edição mais nova não foi aceita';
  end if;

  -- resposta desfeita do histórico continua desfeita
  insert into public.ciclo_registros (colecao, id, dados, editado_em, excluido_em, esquema_versao)
  values ('revlog', 'r1', '{}', 100, 100, 7);
  insert into public.ciclo_registros (colecao, id, dados, editado_em, excluido_em, esquema_versao)
  values ('revlog', 'r1', '{}', 9999, null, 7)
  on conflict (user_id, colecao, id) do update set editado_em = excluded.editado_em, excluido_em = excluded.excluido_em;
  if (select excluido_em from public.ciclo_registros where colecao = 'revlog' and id = 'r1') is null then
    raise exception 'FALHOU: resposta desfeita voltou a ficar viva';
  end if;

  -- versão de dados antiga é recusada
  ok := false;
  begin
    insert into public.ciclo_registros (colecao, id, dados, editado_em, esquema_versao) values ('notas', 'n2', '{}', 1, 6);
  exception when sqlstate 'P0001' then ok := true;
  end;
  if not ok then raise exception 'FALHOU: versão antiga foi aceita'; end if;

  -- coleção desconhecida é recusada
  ok := false;
  begin
    insert into public.ciclo_registros (colecao, id, dados, editado_em, esquema_versao) values ('outra', 'x', '{}', 1, 7);
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'FALHOU: coleção desconhecida foi aceita'; end if;

  -- não dá para gravar em nome de outra pessoa (o dono vira quem está gravando)
  insert into public.ciclo_registros (user_id, colecao, id, dados, editado_em, esquema_versao)
  values ('00000000-0000-4000-8000-0000000000b1', 'notas', 'n3', '{}', 1, 7);
  if (select user_id from public.ciclo_registros where colecao = 'notas' and id = 'n3') <> '00000000-0000-4000-8000-0000000000a1' then
    raise exception 'FALHOU: gravou em nome de outra pessoa';
  end if;

  -- apagar é proibido
  ok := false;
  begin
    delete from public.ciclo_registros where id = 'n1';
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'FALHOU: o app conseguiu apagar'; end if;

  -- hora do servidor e configuração
  if public.ciclo_agora() < 1700000000000 then raise exception 'FALHOU: ciclo_agora()'; end if;
  if (select count(*) from public.ciclo_config where chave = 'esquema_minimo') <> 1 then raise exception 'FALHOU: config'; end if;

  -- aparelho
  insert into public.ciclo_dispositivos (id, nome) values ('00000000-0000-4000-8000-00000000d001', 'Computador');
  select count(*) into n from public.ciclo_dispositivos;
  if n <> 1 then raise exception 'FALHOU: aparelho'; end if;
end $$;

-- ===== usuário B: não vê nem altera nada de A =====
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}';

do $$
declare
  n integer;
begin
  select count(*) into n from public.ciclo_registros;
  if n <> 0 then raise exception 'FALHOU: B viu % registro(s) de A', n; end if;
  select count(*) into n from public.ciclo_dispositivos;
  if n <> 0 then raise exception 'FALHOU: B viu aparelhos de A'; end if;

  update public.ciclo_registros set dados = '{"t":"invadido"}' where id = 'n1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: B alterou registro de A'; end if;
end $$;

-- ===== sem login (chave pública anon): nenhum acesso =====
reset role;
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

do $$
declare
  ok boolean := false;
begin
  begin
    perform 1 from public.ciclo_registros limit 1;
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'FALHOU: anon conseguiu ler'; end if;

  ok := false;
  begin
    perform public.ciclo_agora();
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'FALHOU: anon conseguiu chamar ciclo_agora()'; end if;
end $$;

reset role;

-- conferência final (como administrador): A gravou exatamente o esperado e o texto de B não entrou
do $$
begin
  if (select dados ->> 't' from public.ciclo_registros where user_id = '00000000-0000-4000-8000-0000000000a1' and id = 'n1') <> 'nova' then
    raise exception 'FALHOU: conferência final';
  end if;
end $$;

rollback;

-- só chega aqui se nenhuma regra falhou
select 'TODOS OS TESTES PASSARAM (nada ficou gravado: a transação foi desfeita)' as resultado;
