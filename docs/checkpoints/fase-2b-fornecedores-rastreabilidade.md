# Checkpoint — Fase 2B Fornecedores e Rastreabilidade

## O que foi implementado

- Busca usando backend como fonte principal.
- Pagina dedicada `/fornecedores` para listar fornecedores.
- Fornecedor 360 com nomes encontrados no arquivo, origem e explicacao de ligacoes.
- Linhas por origem/arquivo com filtros por arquivo, categoria, cidade, alerta e texto.
- Relatorio do fornecedor com linguagem simples.
- Resumo do arquivo com termos simplificados.

## O que nao foi mexido

- Banco.
- Migrations.
- Schema.
- ETL.
- raw_json.
- Backfill.
- Linker.
- SQL.
- `/process`.
- `/analyze`.
- Calculos de contratos.
- Calculos de pagamentos.

## Limitacoes

- Ranking ainda vem principalmente de `standardized_records`.
- Facts de contratos e pagamentos sao complemento da leitura do fornecedor.
- Alertas por nome ainda exigem conferencia.
- Licitacoes seguem adiadas.
- Sem CNPJ/QSA/PNCP/benchmark.

## Proximo passo

B2 — fortalecer aliases, deduplicacao e historico cross-upload com auditoria mais profunda.
