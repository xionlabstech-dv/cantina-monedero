-- ============================================================================
-- STORAGE: bucket "fotos-personas" (fotos de estudiantes/docentes/personal)
-- Ejecutar en el SQL Editor de Supabase, en el proyecto de Cantina.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('fotos-personas', 'fotos-personas', true)
on conflict (id) do nothing;

-- Lectura pública de las fotos
create policy "fotos_personas_lectura_publica"
  on storage.objects for select
  using (bucket_id = 'fotos-personas');

-- Solo la cantinera (autenticada) puede subir/editar/borrar fotos
create policy "fotos_personas_admin_insert"
  on storage.objects for insert
  with check (bucket_id = 'fotos-personas' and auth.role() = 'authenticated');

create policy "fotos_personas_admin_update"
  on storage.objects for update
  using (bucket_id = 'fotos-personas' and auth.role() = 'authenticated');

create policy "fotos_personas_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'fotos-personas' and auth.role() = 'authenticated');
