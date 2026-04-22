-- ==========================================================
-- FASE 2C - CROSS REFERENCES DE PESSOAS E CONFLITOS DE PAPEL
-- Fonte de verdade no repositório.
-- Nao reaplicar automaticamente em ambientes onde o schema
-- ja foi criado manualmente no Supabase.
-- ==========================================================

create table if not exists public.entity_cross_references (
  id uuid primary key default gen_random_uuid(),
  left_entity_id uuid not null references public.entities(id) on delete cascade,
  right_entity_id uuid not null references public.entities(id) on delete cascade,
  cross_ref_type text not null check (
    cross_ref_type in ('same_person_candidate', 'role_conflict', 'homonym_candidate')
  ),
  confidence_label text not null check (
    confidence_label in ('indicative', 'probable', 'confirmed')
  ),
  confidence_score numeric(5,2) not null check (
    confidence_score >= 0 and confidence_score <= 1
  ),
  match_basis text not null check (
    match_basis in (
      'document_exact',
      'document_and_role',
      'name_normalized',
      'alias_cross',
      'name_similar_family'
    )
  ),
  reason_summary text not null,
  primary_source_upload_id uuid null references public.uploads(id) on delete set null,
  evidence_payload jsonb not null default '{}'::jsonb,
  decision_status text not null default 'open' check (
    decision_status in ('open', 'accepted', 'dismissed')
  ),
  reviewed_by text null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_entity_cross_references_not_same check (left_entity_id <> right_entity_id)
);

create unique index if not exists uq_entity_cross_references_pair_type
  on public.entity_cross_references (left_entity_id, right_entity_id, cross_ref_type);

create index if not exists idx_entity_cross_references_left
  on public.entity_cross_references (left_entity_id);

create index if not exists idx_entity_cross_references_right
  on public.entity_cross_references (right_entity_id);

create index if not exists idx_entity_cross_references_type_confidence
  on public.entity_cross_references (cross_ref_type, confidence_label, confidence_score desc);

create index if not exists idx_entity_cross_references_upload
  on public.entity_cross_references (primary_source_upload_id);

create or replace function public.set_entity_cross_references_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_entity_cross_references_updated_at on public.entity_cross_references;

create trigger trg_entity_cross_references_updated_at
before update on public.entity_cross_references
for each row
execute function public.set_entity_cross_references_updated_at();
