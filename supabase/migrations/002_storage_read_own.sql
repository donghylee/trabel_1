-- 2026-11-02: 사진 지우기가 안 되던 문제 (schema.sql에도 반영됨)
-- Supabase 대시보드 → SQL Editor 에 붙여 넣고 Run. 여러 번 실행해도 안전.
drop policy if exists "photos read own folder" on storage.objects;
create policy "photos read own folder" on storage.objects for select to authenticated
  using (bucket_id in ('post-photos', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);
