-- Social posts (Mastodon, Facebook, X, YouTube...) shown as discussion below news/events.
alter table public.site_content
  add column if not exists discussion_urls text[] not null default '{}';

alter table public.site_content drop constraint if exists site_content_discussion_urls_check;
alter table public.site_content
  add constraint site_content_discussion_urls_check check (cardinality(discussion_urls) <= 5);
