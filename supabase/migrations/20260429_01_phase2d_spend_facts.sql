-- ==========================================================
-- FASE 2D - FATOS ESPECIALIZADOS DA CADEIA DO GASTO
-- Fonte de verdade versionada no repositório.
-- Esta migration cria a camada factual especializada:
--   - bids_facts
--   - contracts_facts
--   - payments_facts
--   - bid_fact_records
--   - contract_fact_records
--   - payment_fact_records
-- ==========================================================

create table if not exists public.bids_facts (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete restrict,
  source_upload_id uuid not null references public.uploads(id) on delete restrict,
  primary_record_id uuid null references public.standardized_records(id) on delete set null,
  winner_entity_id uuid null references public.entities(id) on delete set null,

  bid_number_raw text null,
  bid_number_normalized text null,
  process_number_raw text null,
  process_number_normalized text null,
  modality text null,
  act_type text null,

  object_text text null,
  object_normalized text null,
  object_signature text null,

  estimated_value numeric(16,2) null check (estimated_value is null or estimated_value >= 0),
  awarded_value numeric(16,2) null check (awarded_value is null or awarded_value >= 0),

  event_date date null,
  publication_date date null,
  status text null,

  signature_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contracts_facts (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete restrict,
  source_upload_id uuid not null references public.uploads(id) on delete restrict,
  primary_record_id uuid null references public.standardized_records(id) on delete set null,
  supplier_entity_id uuid null references public.entities(id) on delete set null,

  contract_number_raw text null,
  contract_number_normalized text null,
  bid_number_raw text null,
  bid_number_normalized text null,
  process_number_raw text null,
  process_number_normalized text null,
  modality text null,
  act_type text null,

  object_text text null,
  object_normalized text null,
  object_signature text null,

  contract_value numeric(16,2) null check (contract_value is null or contract_value >= 0),
  start_date date null,
  end_date date null,
  publication_date date null,

  bid_fact_id uuid null references public.bids_facts(id) on delete set null,
  bid_link_status text not null default 'unlinked' check (
    bid_link_status in ('linked_exact', 'linked_probable', 'unlinked')
  ),
  bid_link_basis text null,
  bid_link_score numeric(5,2) null check (
    bid_link_score is null or (bid_link_score >= 0 and bid_link_score <= 1)
  ),
  bid_link_reason text null,

  signature_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments_facts (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete restrict,
  source_upload_id uuid not null references public.uploads(id) on delete restrict,
  primary_record_id uuid null references public.standardized_records(id) on delete set null,
  supplier_entity_id uuid null references public.entities(id) on delete set null,

  payment_number_raw text null,
  payment_number_normalized text null,
  contract_number_raw text null,
  contract_number_normalized text null,
  bid_number_raw text null,
  bid_number_normalized text null,
  process_number_raw text null,
  process_number_normalized text null,
  expense_stage text null,

  object_text text null,
  object_normalized text null,
  object_signature text null,

  payment_value numeric(16,2) not null check (payment_value >= 0),
  payment_date date null,

  contract_fact_id uuid null references public.contracts_facts(id) on delete set null,
  contract_link_status text not null default 'unlinked' check (
    contract_link_status in ('linked_exact', 'linked_probable', 'unlinked')
  ),
  contract_link_basis text null,
  contract_link_score numeric(5,2) null check (
    contract_link_score is null or (contract_link_score >= 0 and contract_link_score <= 1)
  ),
  contract_link_reason text null,

  bid_fact_id uuid null references public.bids_facts(id) on delete set null,
  bid_link_status text not null default 'unlinked' check (
    bid_link_status in ('linked_exact', 'linked_probable', 'unlinked')
  ),
  bid_link_basis text null,
  bid_link_score numeric(5,2) null check (
    bid_link_score is null or (bid_link_score >= 0 and bid_link_score <= 1)
  ),
  bid_link_reason text null,

  signature_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bid_fact_records (
  id uuid primary key default gen_random_uuid(),
  bid_fact_id uuid not null references public.bids_facts(id) on delete cascade,
  standardized_record_id uuid not null references public.standardized_records(id) on delete cascade,
  source_upload_id uuid not null references public.uploads(id) on delete cascade,
  link_role text not null check (link_role in ('primary', 'supporting', 'merged_duplicate')),
  dedupe_reason text null,
  created_at timestamptz not null default now(),
  unique (bid_fact_id, standardized_record_id)
);

create table if not exists public.contract_fact_records (
  id uuid primary key default gen_random_uuid(),
  contract_fact_id uuid not null references public.contracts_facts(id) on delete cascade,
  standardized_record_id uuid not null references public.standardized_records(id) on delete cascade,
  source_upload_id uuid not null references public.uploads(id) on delete cascade,
  link_role text not null check (link_role in ('primary', 'supporting', 'merged_duplicate')),
  dedupe_reason text null,
  created_at timestamptz not null default now(),
  unique (contract_fact_id, standardized_record_id)
);

create table if not exists public.payment_fact_records (
  id uuid primary key default gen_random_uuid(),
  payment_fact_id uuid not null references public.payments_facts(id) on delete cascade,
  standardized_record_id uuid not null references public.standardized_records(id) on delete cascade,
  source_upload_id uuid not null references public.uploads(id) on delete cascade,
  link_role text not null check (link_role in ('primary', 'supporting', 'merged_duplicate')),
  dedupe_reason text null,
  created_at timestamptz not null default now(),
  unique (payment_fact_id, standardized_record_id)
);

create unique index if not exists uq_bids_facts_city_signature
  on public.bids_facts (city_id, signature_hash);

create unique index if not exists uq_contracts_facts_city_signature
  on public.contracts_facts (city_id, signature_hash);

create unique index if not exists uq_payments_facts_city_signature
  on public.payments_facts (city_id, signature_hash);

create index if not exists idx_bids_facts_bid_number
  on public.bids_facts (bid_number_normalized);

create index if not exists idx_bids_facts_process_number
  on public.bids_facts (process_number_normalized);

create index if not exists idx_bids_facts_winner
  on public.bids_facts (winner_entity_id);

create index if not exists idx_bids_facts_object_signature
  on public.bids_facts (object_signature);

create index if not exists idx_bids_facts_dates
  on public.bids_facts (event_date, publication_date);

create index if not exists idx_contracts_facts_contract_number
  on public.contracts_facts (contract_number_normalized);

create index if not exists idx_contracts_facts_bid_number
  on public.contracts_facts (bid_number_normalized);

create index if not exists idx_contracts_facts_process_number
  on public.contracts_facts (process_number_normalized);

create index if not exists idx_contracts_facts_supplier
  on public.contracts_facts (supplier_entity_id);

create index if not exists idx_contracts_facts_bid_fact
  on public.contracts_facts (bid_fact_id);

create index if not exists idx_contracts_facts_bid_link_status
  on public.contracts_facts (bid_link_status);

create index if not exists idx_contracts_facts_object_signature
  on public.contracts_facts (object_signature);

create index if not exists idx_contracts_facts_dates
  on public.contracts_facts (start_date, end_date, publication_date);

create index if not exists idx_payments_facts_payment_number
  on public.payments_facts (payment_number_normalized);

create index if not exists idx_payments_facts_contract_number
  on public.payments_facts (contract_number_normalized);

create index if not exists idx_payments_facts_bid_number
  on public.payments_facts (bid_number_normalized);

create index if not exists idx_payments_facts_process_number
  on public.payments_facts (process_number_normalized);

create index if not exists idx_payments_facts_supplier
  on public.payments_facts (supplier_entity_id);

create index if not exists idx_payments_facts_contract_fact
  on public.payments_facts (contract_fact_id);

create index if not exists idx_payments_facts_bid_fact
  on public.payments_facts (bid_fact_id);

create index if not exists idx_payments_facts_contract_link_status
  on public.payments_facts (contract_link_status);

create index if not exists idx_payments_facts_bid_link_status
  on public.payments_facts (bid_link_status);

create index if not exists idx_payments_facts_payment_date
  on public.payments_facts (payment_date);

create index if not exists idx_payments_facts_object_signature
  on public.payments_facts (object_signature);

create index if not exists idx_bid_fact_records_fact
  on public.bid_fact_records (bid_fact_id);

create index if not exists idx_contract_fact_records_fact
  on public.contract_fact_records (contract_fact_id);

create index if not exists idx_payment_fact_records_fact
  on public.payment_fact_records (payment_fact_id);

create index if not exists idx_bid_fact_records_record
  on public.bid_fact_records (standardized_record_id);

create index if not exists idx_contract_fact_records_record
  on public.contract_fact_records (standardized_record_id);

create index if not exists idx_payment_fact_records_record
  on public.payment_fact_records (standardized_record_id);

create or replace function public.phase2d_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists bids_facts_touch_updated_at on public.bids_facts;
create trigger bids_facts_touch_updated_at
before update on public.bids_facts
for each row execute procedure public.phase2d_touch_updated_at();

drop trigger if exists contracts_facts_touch_updated_at on public.contracts_facts;
create trigger contracts_facts_touch_updated_at
before update on public.contracts_facts
for each row execute procedure public.phase2d_touch_updated_at();

drop trigger if exists payments_facts_touch_updated_at on public.payments_facts;
create trigger payments_facts_touch_updated_at
before update on public.payments_facts
for each row execute procedure public.phase2d_touch_updated_at();
