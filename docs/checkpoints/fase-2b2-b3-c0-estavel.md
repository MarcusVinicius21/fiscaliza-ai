# Checkpoint — B2/B3/C0

## Implementado

- Endpoint read-only de possíveis duplicidades em fornecedores.
- Bloco "Possíveis duplicidades" no Fornecedor 360.
- Nomes encontrados no arquivo com contagem de ocorrências quando disponível.
- Origem simples dos alertas mantida no Fornecedor 360 e exibida no relatório.
- Página `/pessoas` read-only para buscar pessoas e servidores por nome ou documento.
- Ajustes de linguagem em pessoas, investigações e cards de possíveis ligações.

## Não implementado

- Merge automático de fornecedores.
- Deduplicação com gravação no banco.
- Motor novo de pessoas/servidores.
- CNPJ/QSA.
- PNCP.
- CEIS.
- Benchmark.
- Licitações.
- Módulos especializados.
- Migrations.

## Limitações

- Possíveis duplicidades são indícios conservadores e precisam de conferência.
- Alertas encontrados por nome no mesmo arquivo ainda exigem conferência.
- Histórico cross-upload depende dos uploads já existentes e vinculados a entidades.
- Pessoas e servidores dependem das entidades já extraídas.
- A página `/pessoas` não lista tudo sem busca porque não há endpoint read-only de diretório geral para pessoas nesta etapa.

## Próximo passo

Decidir entre:

- Reforçar deduplicação com revisão manual.
- Avançar em pessoas/servidores com diretório read-only dedicado.
- Importar licitações quando houver arquivo adequado.
- Iniciar CNPJ/QSA com cache externo e separação clara entre dado do arquivo e dado externo.
