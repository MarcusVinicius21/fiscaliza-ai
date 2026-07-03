# Checkpoint — Fase 2E CNPJ/QSA: Plano

## Objetivo futuro

Enriquecer a visão do fornecedor com dados cadastrais externos, sem sobrescrever o que veio dos arquivos públicos enviados ao Fiscaliza.AI.

## Campos desejados

- Situação cadastral.
- Data de abertura.
- Capital social.
- QSA/sócios.
- Natureza jurídica.
- Endereço.
- CNAE.

## Cuidados

- Dados externos podem estar defasados ou indisponíveis.
- É necessário cache para evitar consultas repetidas e instáveis.
- O dado externo deve ficar separado do dado encontrado no arquivo.
- Nunca sobrescrever documento, nome ou valor extraído do arquivo original.
- Mostrar sempre fonte, data da consulta e aviso de conferência.

## UI futura no Fornecedor 360

- Bloco "Dados cadastrais externos".
- Bloco "Sócios e administradores".
- Selo "Fonte externa".
- Texto "Precisa de conferência" quando houver divergência.

## Fora desta etapa

- Integração com API externa.
- Criação de tabela.
- Consulta real de CNPJ.
- Qualquer conclusão automática.
