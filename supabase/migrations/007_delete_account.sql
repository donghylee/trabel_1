-- 회원 탈퇴: 로그인한 사람이 자기 계정을 지운다.
-- auth.users를 지우면 profiles → 여행·일정·글·댓글·좋아요·북마크·메시지·알림 구독·일정 알림이 연결 규칙(on delete cascade)으로 함께 지워진다.
-- 저장소 사진(post-photos·avatars·dm-photos)은 SQL로 지울 수 없어(Storage API 전용) 앱이 먼저 지운다 (src/lib/auth.ts deleteAccount).

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'login required';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
