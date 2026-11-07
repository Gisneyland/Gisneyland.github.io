-- News/event detail body can now be plain text, Markdown or sanitised HTML.
alter table public.site_content
  add column if not exists body_format text not null default 'text';

alter table public.site_content drop constraint if exists site_content_body_format_check;
alter table public.site_content
  add constraint site_content_body_format_check check (body_format in ('text', 'markdown', 'html'));
