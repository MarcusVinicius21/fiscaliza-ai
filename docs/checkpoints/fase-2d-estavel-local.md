# Fiscaliza.AI - Checkpoint Fase 2D Estavel Local

## Commits finais

- `0760a92` - Usa Webpack no dev server do frontend
- `dca9355` - Corrige carregamento antecipado do env no backend
- `4db4f0c` - Ajusta parsing monetario decimal no backfill da Fase 2D
- `d5967fe` - Corrige parsing monetario do backfill da Fase 2D
- `920bb20` - Implementa Etapa D com cadeia factual de gasto

Tag local/remota de referencia:

- `fase-2d-estavel-local`

## Estado validado

- Fase 2D estabilizada localmente.
- Backend sobe com carregamento antecipado de `backend/.env`.
- Frontend roda em desenvolvimento com Next.js 16 usando Webpack.
- Backfill da Fase 2D corrigido para valores monetarios normalizados e formatos BR.
- Contratos e pagamentos foram corrigidos e validados visualmente.

## Contagens factuais atuais

- Contratos materializados: `12`
- Pagamentos materializados: `20`
- Licitacoes materializadas: `0`

## Linker

O linker foi executado apenas em `dry-run`.

Resultado observado:

- `bids=0`
- `contracts=12`
- `payments=20`
- Sem vinculos encontrados entre pagamentos, contratos e licitacoes.

Interpretação operacional:

- A ausencia de vinculo nao deve ser tratada como erro, fraude ou irregularidade.
- O arquivo de despesas/pagamentos nao trouxe chaves suficientes para ligacao automatica, como numero de contrato, numero de licitacao, numero de processo ou objeto textual compativel.
- Como `bids_facts` esta zerada, nao ha base factual de licitacoes para completar a cadeia neste momento.

## Decisao de produto

Licitações foram adiadas nesta estabilizacao.

A decisao atual e nao forcar cadeia completa artificialmente. A interface deve explicar de forma clara e factual quando um contrato ou pagamento aparece como sem vinculo factual encontrado.

## Proxima etapa

1. Explicabilidade de vinculos ausentes na UX.
2. Diagnostico do upload para mostrar quais chaves vieram ou nao vieram nos arquivos carregados.
3. Fornecedor 360, consolidando visao por fornecedor com contratos, pagamentos, alertas e lacunas de rastreabilidade.
