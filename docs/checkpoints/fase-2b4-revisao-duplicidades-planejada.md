# Checkpoint — Fase 2B4 Revisão Manual de Duplicidades Planejada

## Objetivo
Explicar que a etapa prepara a revisão manual de possíveis duplicidades entre fornecedores/pessoas/entidades, sem merge automático.

## O que foi preparado
- migration planejada;
- rollback planejado;
- tabela sugerida;
- decisões possíveis;
- limites de segurança.

## O que a tabela faz
- registra pares de entidades parecidas;
- registra decisão humana;
- guarda evidência em snapshot JSON;
- guarda observação do revisor.

## O que a tabela NÃO faz
- não une fornecedores;
- não altera entities;
- não altera aliases;
- não altera standardized_records;
- não altera contratos;
- não altera pagamentos;
- não mexe no ETL;
- não prova irregularidade.

## Status das decisões
- needs_review = precisa revisar
- possible_same = pode ser o mesmo fornecedor
- not_same = não é o mesmo fornecedor
- ignored = ignorado por enquanto

## Risco de falso positivo
Nome parecido não confirma nada, por isso não há união automática sem revisão humana. O risco de falso positivo é alto apenas com base em nome/documento parcial.

## Plano de aplicação futura
Passos futuros:
1. revisar migration;
2. aplicar em ambiente seguro;
3. validar tabela vazia;
4. criar endpoints de gravação;
5. criar tela de revisão;
6. permitir decisão humana;
7. nunca fazer merge automático sem nova etapa.

## Rollback
Criado o arquivo de rollback em: `docs/sql-rollbacks/20260703_rollback_phase2b4_duplicate_review.sql`

## Segurança
Confirmamos que nada foi aplicado no banco nesta etapa.
