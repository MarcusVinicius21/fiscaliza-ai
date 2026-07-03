-- ==========================================================
-- FASE 2B4 - REVISÃO MANUAL DE POSSÍVEIS DUPLICIDADES
-- Migration preparatória. NÃO aplicar automaticamente.
-- Serve para registrar decisões humanas sobre entidades.
-- ==========================================================

create table if not exists public.entity_duplicate_reviews (
  id uuid primary key default gen_random_uuid(),
  primary_entity_id uuid not null references public.entities(id) on delete cascade,
  duplicate_entity_id uuid not null references public.entities(id) on delete cascade,
  review_status text not null default 'needs_review' check (
    review_status in ('needs_review', 'possible_same', 'not_same', 'ignored')
  ),
  review_reason text null,
  confidence_label text null check (
    confidence_label is null or confidence_label in ('indicio', 'provavel', 'confirmado_pelo_usuario')
  ),
  evidence_snapshot jsonb not null default '{}'::jsonb,
  reviewer_name text null,
  reviewer_note text null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  constraint chk_duplicate_review_self check (primary_entity_id <> duplicate_entity_id)
);

-- Índices básicos
create index if not exists idx_entity_duplicate_reviews_primary
  on public.entity_duplicate_reviews (primary_entity_id);

create index if not exists idx_entity_duplicate_reviews_duplicate
  on public.entity_duplicate_reviews (duplicate_entity_id);

create index if not exists idx_entity_duplicate_reviews_status
  on public.entity_duplicate_reviews (review_status);

create index if not exists idx_entity_duplicate_reviews_created
  on public.entity_duplicate_reviews (created_at);

-- Evitar duplicidade A-B e B-A
create unique index if not exists uq_entity_duplicate_reviews_pair
  on public.entity_duplicate_reviews (
    least(primary_entity_id::text, duplicate_entity_id::text),
    greatest(primary_entity_id::text, duplicate_entity_id::text)
  );

-- Comentários informativos
comment on table public.entity_duplicate_reviews is 'A tabela não faz merge. A tabela não altera entidades. A tabela serve apenas para registrar revisão humana. Duplicidades são indícios e exigem conferência.';
