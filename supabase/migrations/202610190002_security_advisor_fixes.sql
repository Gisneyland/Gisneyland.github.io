drop extension if exists pg_graphql;

revoke all on function public.has_admin_permission(text) from public, anon;
grant execute on function public.has_admin_permission(text) to authenticated;

revoke all on function public.rls_auto_enable() from public, anon, authenticated;