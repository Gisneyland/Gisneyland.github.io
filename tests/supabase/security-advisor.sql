\set ON_ERROR_STOP on
begin;

drop function if exists public.rls_auto_enable() cascade;
\ir ../../supabase/migrations/202610190002_security_advisor_fixes.sql

create function public.rls_auto_enable() returns event_trigger
language plpgsql as $$ begin end; $$;
grant execute on function public.rls_auto_enable() to public, anon, authenticated;

\ir ../../supabase/migrations/202610190002_security_advisor_fixes.sql

do $$
begin
  if has_function_privilege('anon', 'public.rls_auto_enable()', 'execute')
    or has_function_privilege('authenticated', 'public.rls_auto_enable()', 'execute') then
    raise exception 'rls_auto_enable must not be executable by public, anon, or authenticated';
  end if;
  if not has_function_privilege(current_user, 'public.rls_auto_enable()', 'execute') then
    raise exception 'rls_auto_enable owner must retain execute permission';
  end if;
end $$;

rollback;
