# Checkpoint — Fase 2D Cadeia do Gasto: Pendências

## Estado atual

- Contratos já existem e foram validados com valores corrigidos.
- Pagamentos já existem e foram validados com valores corrigidos.
- Licitações seguem adiadas por decisão de produto.
- `bids_facts` permanece zerado no cenário atual.
- Linker real não deve ser rodado neste momento.
- Pagamentos seguem sem contrato ligado automaticamente quando o arquivo não traz chaves suficientes.
- Contratos seguem sem licitação ligada quando não há upload de licitações carregado.

## O que será necessário quando licitações forem importadas

- Conferir o arquivo de licitações antes de qualquer carga.
- Validar colunas de número de processo, modalidade, objeto, fornecedor e valor.
- Rodar backfill apenas depois de dry-run e conferência dos valores.
- Validar `bids_facts` e `bid_fact_records`.
- Só depois avaliar linker em dry-run.
- Rodar linker real apenas com autorização explícita.

## Telas a revisitar

- `/licitacoes`
- `/licitacoes/[id]`
- `/contratos`
- `/contratos/[id]`
- `/pagamentos`
- `/pagamentos/[id]`
- Fornecedor 360
- Relatórios imprimíveis

## Validações necessárias

- Contagens por upload.
- Valores monetários contra `standardized_records`.
- Registros sem ligação automática.
- Contratos ligados a licitações.
- Pagamentos ligados a contratos.
- Mensagens de ausência de ligação com linguagem cautelosa.
