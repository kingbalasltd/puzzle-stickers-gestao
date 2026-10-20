-- Puzzle Stickers · Gestão — cloud copy of the app's records (kb-academy project).
-- Private schema; the app only reaches it through the public puzzle_* functions,
-- which check a company password session. Last write wins on the record's
-- own updatedAt ("versao").

create schema if not exists puzzle;
revoke all on schema puzzle from public, anon, authenticated;

create table if not exists puzzle.empresas (
  id text primary key,
  nome text not null,
  senha_hash text not null,
  falhas int not null default 0,
  bloqueado_ate timestamptz,
  criado_em timestamptz not null default now()
);

create table if not exists puzzle.sessoes (
  token_hash text primary key,
  empresa_id text not null references puzzle.empresas(id) on delete cascade,
  aparelho text,
  criado_em timestamptz not null default now(),
  visto_em timestamptz not null default now()
);

create sequence if not exists puzzle.docs_seq;

create table if not exists puzzle.docs (
  empresa_id text not null references puzzle.empresas(id) on delete cascade,
  tabela text not null,
  id text not null,
  dados jsonb not null,
  versao text not null,
  seq bigint not null default nextval('puzzle.docs_seq'),
  servidor_em timestamptz not null default now(),
  primary key (empresa_id, tabela, id)
);
create index if not exists docs_empresa_seq on puzzle.docs (empresa_id, seq);

alter table puzzle.empresas enable row level security;
alter table puzzle.sessoes enable row level security;
alter table puzzle.docs enable row level security;

-- Session token → company. Raises when the token is unknown.
create or replace function puzzle.empresa_do_token(p_token text)
returns text language plpgsql security definer set search_path = '' as $$
declare emp text;
begin
  update puzzle.sessoes set visto_em = now()
   where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
  returning empresa_id into emp;
  if emp is null then
    raise exception 'sessao' using errcode = '28000';
  end if;
  return emp;
end $$;
revoke all on function puzzle.empresa_do_token(text) from public, anon, authenticated;

-- Company code + password → session token. 5 wrong tries lock it for 10 minutes.
create or replace function public.puzzle_entrar(p_empresa text, p_senha text, p_aparelho text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare e puzzle.empresas; tok text;
begin
  select * into e from puzzle.empresas where id = lower(trim(coalesce(p_empresa, '')));
  if e.id is null then
    return jsonb_build_object('erro', 'credenciais');
  end if;
  if e.bloqueado_ate is not null and e.bloqueado_ate > now() then
    return jsonb_build_object('erro', 'bloqueado');
  end if;
  if e.senha_hash <> extensions.crypt(coalesce(p_senha, ''), e.senha_hash) then
    update puzzle.empresas
       set falhas = falhas + 1,
           bloqueado_ate = case when falhas + 1 >= 5 then now() + interval '10 minutes' end
     where id = e.id;
    return jsonb_build_object('erro', 'credenciais');
  end if;
  update puzzle.empresas set falhas = 0, bloqueado_ate = null where id = e.id;
  tok := encode(extensions.gen_random_bytes(32), 'hex');
  insert into puzzle.sessoes (token_hash, empresa_id, aparelho)
  values (encode(extensions.digest(tok, 'sha256'), 'hex'), e.id, left(p_aparelho, 160));
  return jsonb_build_object('token', tok, 'empresa', e.id, 'nome', e.nome);
end $$;

-- Records changed after the cursor (the client asks with some overlap).
create or replace function public.puzzle_puxar(p_token text, p_desde bigint default 0, p_limite int default 500)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare emp text; res jsonb; ate bigint;
begin
  emp := puzzle.empresa_do_token(p_token);
  select coalesce(jsonb_agg(jsonb_build_object('t', x.tabela, 'd', x.dados) order by x.seq), '[]'::jsonb), max(x.seq)
    into res, ate
    from (select tabela, dados, seq from puzzle.docs
           where empresa_id = emp and seq > coalesce(p_desde, 0)
           order by seq limit least(greatest(coalesce(p_limite, 500), 1), 1000)) x;
  return jsonb_build_object('docs', res, 'ate', coalesce(ate, coalesce(p_desde, 0)));
end $$;

-- Upsert a batch; a record only replaces the stored one when its versao is newer.
create or replace function public.puzzle_enviar(p_token text, p_docs jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  emp text; d jsonb; n int := 0;
  tabs text[] := array['empresa','utilizadores','clientes','fornecedores','servicos','trabalhos','pagamentos','requisicoes','custos','documentos','cotacoes','registos','despesasFixas','despesas','relatorios','tarefas'];
begin
  emp := puzzle.empresa_do_token(p_token);
  if jsonb_typeof(p_docs) <> 'array' or jsonb_array_length(p_docs) > 500 then
    raise exception 'lote invalido';
  end if;
  for d in select value from jsonb_array_elements(p_docs) loop
    continue when not (d->>'t' = any(tabs))
      or coalesce(d->'d'->>'id', '') = ''
      or coalesce(d->>'v', '') = ''
      or length(d::text) > 300000;
    insert into puzzle.docs (empresa_id, tabela, id, dados, versao)
    values (emp, d->>'t', d->'d'->>'id', d->'d', d->>'v')
    on conflict (empresa_id, tabela, id) do update
      set dados = excluded.dados, versao = excluded.versao,
          seq = nextval('puzzle.docs_seq'), servidor_em = now()
      where puzzle.docs.versao < excluded.versao;
    if found then n := n + 1; end if;
  end loop;
  return jsonb_build_object('aceites', n);
end $$;

create or replace function public.puzzle_mudar_senha(p_token text, p_atual text, p_nova text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare emp text; h text;
begin
  emp := puzzle.empresa_do_token(p_token);
  select senha_hash into h from puzzle.empresas where id = emp;
  if h <> extensions.crypt(coalesce(p_atual, ''), h) then
    return jsonb_build_object('erro', 'senha');
  end if;
  if length(coalesce(p_nova, '')) < 8 then
    return jsonb_build_object('erro', 'curta');
  end if;
  update puzzle.empresas set senha_hash = extensions.crypt(p_nova, extensions.gen_salt('bf', 10)) where id = emp;
  -- Other devices must sign in again with the new password.
  delete from puzzle.sessoes
   where empresa_id = emp and token_hash <> encode(extensions.digest(p_token, 'sha256'), 'hex');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.puzzle_sair(p_token text)
returns void language sql security definer set search_path = '' as $$
  delete from puzzle.sessoes where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

revoke all on function public.puzzle_entrar(text, text, text) from public;
revoke all on function public.puzzle_puxar(text, bigint, int) from public;
revoke all on function public.puzzle_enviar(text, jsonb) from public;
revoke all on function public.puzzle_mudar_senha(text, text, text) from public;
revoke all on function public.puzzle_sair(text) from public;
grant execute on function public.puzzle_entrar(text, text, text) to anon, authenticated;
grant execute on function public.puzzle_puxar(text, bigint, int) to anon, authenticated;
grant execute on function public.puzzle_enviar(text, jsonb) to anon, authenticated;
grant execute on function public.puzzle_mudar_senha(text, text, text) to anon, authenticated;
grant execute on function public.puzzle_sair(text) to anon, authenticated;
