-- Categorized outlet navigation requires no schema change. This migration adds
-- Root Owner-controlled, public product imagery for fast visual recognition.

begin;

alter table public.products
  add column if not exists image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "product images are publicly readable" on storage.objects;
create policy "product images are publicly readable"
on storage.objects for select
to public
using (bucket_id = 'product-images');

drop policy if exists "root owner uploads product images" on storage.objects;
create policy "root owner uploads product images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and auth.uid() = '4b36aa09-11b2-4b2e-9322-69e4f1a80001'::uuid
  and public.current_user_role() = 'SUPER_ADMIN'
);

drop policy if exists "root owner replaces product images" on storage.objects;
create policy "root owner replaces product images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'product-images'
  and auth.uid() = '4b36aa09-11b2-4b2e-9322-69e4f1a80001'::uuid
  and public.current_user_role() = 'SUPER_ADMIN'
)
with check (
  bucket_id = 'product-images'
  and auth.uid() = '4b36aa09-11b2-4b2e-9322-69e4f1a80001'::uuid
  and public.current_user_role() = 'SUPER_ADMIN'
);

drop policy if exists "root owner deletes product images" on storage.objects;
create policy "root owner deletes product images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'product-images'
  and auth.uid() = '4b36aa09-11b2-4b2e-9322-69e4f1a80001'::uuid
  and public.current_user_role() = 'SUPER_ADMIN'
);

create or replace function public.root_set_product_image(
  target_product_id uuid,
  new_image_url text
)
returns setof public.products
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() <> '4b36aa09-11b2-4b2e-9322-69e4f1a80001'::uuid
     or public.current_user_role() <> 'SUPER_ADMIN' then
    raise exception 'Root Owner access required';
  end if;
  if new_image_url is not null and (
    length(new_image_url) > 2000
    or new_image_url not like ('%/storage/v1/object/public/product-images/' || target_product_id::text || '/%')
  ) then
    raise exception 'Invalid product image URL';
  end if;

  update public.products
  set image_url = new_image_url, updated_at = now()
  where id = target_product_id and is_active;
  if not found then raise exception 'Active product not found'; end if;

  return query select p.* from public.products p where p.id = target_product_id;
end;
$$;

revoke all on function public.root_set_product_image(uuid,text) from public, anon;
grant execute on function public.root_set_product_image(uuid,text) to authenticated;

commit;
