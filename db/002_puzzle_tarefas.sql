-- 002 (16 Out 2026): a tabela 'tarefas' passa a ser aceite pela nuvem.
-- Aplicada no Supabase como migração "puzzle_002_tarefas" (versão 20261016084515).
-- Substitui puzzle_enviar do 001: a única diferença é 'tarefas' na lista de tabelas aceites.
-- Atenção: qualquer tabela nova da app tem de entrar nesta lista (e em TABELAS em src/nuvem.ts).

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
revoke all on function public.puzzle_enviar(text, jsonb) from public;
grant execute on function public.puzzle_enviar(text, jsonb) to anon, authenticated;
