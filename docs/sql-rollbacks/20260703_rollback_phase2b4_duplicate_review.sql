-- ==========================================================
-- ROLLBACK FASE 2B4 - REVISÃO MANUAL DE POSSÍVEIS DUPLICIDADES
-- Use somente se a migration ainda não recebeu decisões 
-- reais de revisão ou após backup.
-- ==========================================================

-- Aviso: rollback apaga decisões humanas se já houver dados.
drop table if exists public.entity_duplicate_reviews cascade;
