-- ==========================================================
-- FASE 2B - CAMADA DE ENTIDADES
-- Fonte de verdade do schema no repositório.
-- NÃO reaplicar automaticamente em ambientes onde o SQL
-- já foi executado manualmente.
-- ==========================================================

create extension if not exists pg_trgm;

create table if not exists public.entities (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (
    entity_type in ('supplier', 'person', 'server', 'organization', 'other')
  ),
  canonical_name text not null,
  document text null,
  normalized_name text not null,
  source_confidence numeric(5,2) not null default 0.70 check (
    source_confidence >= 0 and source_confidence <= 1
  ),
  created_at timestamptz not null default now()
);

create table if not exists public.entity_aliases (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  alias_name text not null,
  alias_type text not null check (
    alias_type in ('raw_record_name', 'manual_review', 'legacy_name', 'document_variant', 'normalized_variant')
  ),
  normalized_alias text not null,
  source_upload_id uuid null references public.uploads(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.entity_relationships (
  id uuid primary key default gen_random_uuid(),
  from_entity_id uuid not null references public.entities(id) on delete cascade,
  to_entity_id uuid not null references public.entities(id) on delete cascade,
  relationship_type text not null check (
    relationship_type in ('appears_within_same_record', 'same_document_family', 'explicit_counterparty_in_record')
  ),
  source_type text not null check (
    source_type in ('standardized_record', 'raw_json', 'manual_review')
  ),
  source_reference text null,
  confidence_score numeric(5,2) not null default 0.50 check (
    confidence_score >= 0 and confidence_score <= 1
  ),
  created_at timestamptz not null default now(),
  constraint chk_entity_relationship_self check (from_entity_id <> to_entity_id)
);

create table if not exists public.record_entity_links (
  id uuid primary key default gen_random_uuid(),
  standardized_record_id uuid not null references public.standardized_records(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  role_in_record text not null check (
    role_in_record in ('supplier', 'creditor', 'contracted_party', 'beneficiary', 'server', 'person', 'other')
  ),
  match_type text not null check (
    match_type in ('document_exact', 'name_exact', 'name_normalized', 'manual_seed', 'fallback_name')
  ),
  match_confidence numeric(5,2) not null default 0.70 check (
    match_confidence >= 0 and match_confidence <= 1
  ),
  created_at timestamptz not null default now()
);

create index if not exists idx_entities_type_normalized_name
  on public.entities (entity_type, normalized_name);

create index if not exists idx_entities_document
  on public.entities (document);

create unique index if not exists uq_entities_type_document
  on public.entities (entity_type, document)
  where document is not null and document <> '';

create unique index if not exists uq_entities_supplier_name_without_document
  on public.entities (entity_type, normalized_name)
  where entity_type in ('supplier', 'organization')
    and (document is null or document = '');

create unique index if not exists uq_entity_aliases_entity_alias
  on public.entity_aliases (entity_id, normalized_alias);

create index if not exists idx_entity_aliases_normalized_alias
  on public.entity_aliases (normalized_alias);

create index if not exists idx_entity_aliases_source_upload_id
  on public.entity_aliases (source_upload_id);

create unique index if not exists uq_entity_relationships_unique
  on public.entity_relationships (
    from_entity_id,
    to_entity_id,
    relationship_type,
    source_type,
    coalesce(source_reference, '')
  );

create index if not exists idx_entity_relationships_from
  on public.entity_relationships (from_entity_id);

create index if not exists idx_entity_relationships_to
  on public.entity_relationships (to_entity_id);

create unique index if not exists uq_record_entity_links_unique
  on public.record_entity_links (standardized_record_id, entity_id, role_in_record);

create index if not exists idx_record_entity_links_entity
  on public.record_entity_links (entity_id);

create index if not exists idx_record_entity_links_record
  on public.record_entity_links (standardized_record_id);

create index if not exists idx_record_entity_links_role
  on public.record_entity_links (role_in_record);

create index if not exists idx_entities_canonical_name_trgm
  on public.entities using gin (canonical_name gin_trgm_ops);

create index if not exists idx_entity_aliases_alias_trgm
  on public.entity_aliases using gin (alias_name gin_trgm_ops);
