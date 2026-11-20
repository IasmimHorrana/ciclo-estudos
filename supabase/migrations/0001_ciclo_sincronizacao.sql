-- Ciclo de Estudos: sincronização entre aparelhos (etapa 5.2).
--
-- Roda no projeto do Supabase "financas-app", que é compartilhado com o app de finanças.
-- Por isso TUDO aqui começa com "ciclo_" e nada do app de finanças (tabela "records") é tocado.
-- Pode ser rodado de novo sem estragar nada (usa "if not exists" / "or replace").
--
-- Regras (as mesmas de app/src/dominio/sincronia.ts):
--   * cada linha pertence a um usuário; só o próprio usuário lê e grava as suas (RLS);
--   * quem não entrou na conta (chave pública "anon") não vê nada;
--   * o servidor não deixa uma edição mais velha sobrescrever uma mais nova;
--   * uma resposta desfeita do histórico (revlog) não volta a ficar viva;
--   * app com versão de dados antiga demais é recusado (para não gravar formato velho);
--   * nada é apagado pelo app: não existe permissão de DELETE.

-- 1) Registros: uma linha por item do app (cartão, nota, assunto, configuração...).
create table if not exists public.ciclo_registros (
  user_id        uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  colecao        text        not null check (colecao in (
                   'valores', 'semanasFechadas', 'modelos', 'notas', 'assuntos', 'materiasEdital', 'questoes',
                   'sessoes', 'baralhos', 'gruposOpcoes', 'tiposNota', 'notasFc', 'cartoes', 'revlog')),
  id             text        not null check (length(id) between 1 and 200),
  dados          jsonb       not null,
  editado_em     bigint      not null,               -- hora da edição (ms), já no relógio do servidor: decide conflitos
  excluido_em    bigint,                             -- hora da exclusão (ms) ou null se vivo
  esquema_versao integer     not null,
  atualizado_em  timestamptz not null default clock_timestamp(), -- preenchido pelo servidor: cursor de "puxar"
  primary key (user_id, colecao, id)
);

-- "Puxar o que mudou desde o cursor", em ordem, por usuário.
create index if not exists ciclo_registros_puxar on public.ciclo_registros (user_id, atualizado_em, colecao, id);

-- 2) Configuração do lado da nuvem (só leitura para o app): versão mínima dos dados aceita.
create table if not exists public.ciclo_config (
  chave text primary key,
  valor jsonb not null
);
insert into public.ciclo_config (chave, valor) values ('esquema_minimo', '7')
  on conflict (chave) do nothing;

-- 3) Aparelhos: quando cada um sincronizou por último (para saber quando é seguro limpar exclusões antigas).
create table if not exists public.ciclo_dispositivos (
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id          uuid        not null,
  nome        text        not null default '' check (length(nome) <= 60),
  ultima_sync timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);

-- 4) Gatilho dos registros: dono, versão mínima, "mais nova vence", resposta desfeita fica desfeita, hora do servidor.
create or replace function public.ciclo_registros_antes_de_gravar()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  minimo integer;
begin
  -- o dono é sempre quem está gravando (não dá para gravar em nome de outra pessoa)
  new.user_id := auth.uid();
  if new.user_id is null then
    raise exception 'ciclo: é preciso entrar na conta' using errcode = '42501';
  end if;

  select (valor #>> '{}')::integer into minimo from public.ciclo_config where chave = 'esquema_minimo';
  if minimo is not null and new.esquema_versao < minimo then
    raise exception 'ciclo: atualize o app (versão dos dados % é menor que a mínima %)', new.esquema_versao, minimo
      using errcode = 'P0001';
  end if;

  if tg_op = 'UPDATE' then
    if new.colecao = 'revlog' then
      -- linha do histórico desfeita não volta a ficar viva
      if old.excluido_em is not null and new.excluido_em is null then
        return null; -- ignora esta gravação e mantém a que está
      end if;
    elsif new.editado_em < old.editado_em then
      return null; -- edição mais velha: mantém a mais nova que já está na nuvem
    end if;
  end if;

  new.atualizado_em := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists ciclo_registros_antes_de_gravar on public.ciclo_registros;
create trigger ciclo_registros_antes_de_gravar
  before insert or update on public.ciclo_registros
  for each row execute function public.ciclo_registros_antes_de_gravar();

-- 5) Hora do servidor em ms (o app mede o desvio do próprio relógio com ela).
create or replace function public.ciclo_agora()
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$ select (extract(epoch from clock_timestamp()) * 1000)::bigint $$;

-- 6) Segurança: RLS ligada e só o próprio usuário logado acessa as suas linhas.
alter table public.ciclo_registros    enable row level security;
alter table public.ciclo_config       enable row level security;
alter table public.ciclo_dispositivos enable row level security;

-- quem não entrou na conta não tem acesso a nada do Ciclo
revoke all on public.ciclo_registros, public.ciclo_config, public.ciclo_dispositivos from anon;
revoke all on function public.ciclo_agora() from public, anon;
revoke all on function public.ciclo_registros_antes_de_gravar() from public, anon, authenticated;

-- usuário logado: ler, criar e alterar (nunca apagar) as próprias linhas
revoke delete, truncate on public.ciclo_registros, public.ciclo_dispositivos from authenticated;
grant select, insert, update on public.ciclo_registros, public.ciclo_dispositivos to authenticated;
revoke all on public.ciclo_config from authenticated;
grant select on public.ciclo_config to authenticated;
grant execute on function public.ciclo_agora() to authenticated;

drop policy if exists ciclo_registros_ler on public.ciclo_registros;
drop policy if exists ciclo_registros_criar on public.ciclo_registros;
drop policy if exists ciclo_registros_alterar on public.ciclo_registros;
create policy ciclo_registros_ler     on public.ciclo_registros for select to authenticated using ((select auth.uid()) = user_id);
create policy ciclo_registros_criar   on public.ciclo_registros for insert to authenticated with check ((select auth.uid()) = user_id);
create policy ciclo_registros_alterar on public.ciclo_registros for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists ciclo_dispositivos_ler on public.ciclo_dispositivos;
drop policy if exists ciclo_dispositivos_criar on public.ciclo_dispositivos;
drop policy if exists ciclo_dispositivos_alterar on public.ciclo_dispositivos;
create policy ciclo_dispositivos_ler     on public.ciclo_dispositivos for select to authenticated using ((select auth.uid()) = user_id);
create policy ciclo_dispositivos_criar   on public.ciclo_dispositivos for insert to authenticated with check ((select auth.uid()) = user_id);
create policy ciclo_dispositivos_alterar on public.ciclo_dispositivos for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists ciclo_config_ler on public.ciclo_config;
create policy ciclo_config_ler on public.ciclo_config for select to authenticated using (true);
