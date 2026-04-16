# Fiscaliza.AI Design System Master

## Direção

Pattern principal: Public Accountability SaaS.

Style principal: Light Premium SaaS com composição editorial, bento grid discreto e hierarquia de evidências. A referência visual primária é uma interface clara, organizada, com sidebar leve, superfícies brancas e leitura rápida.

Dashboard style: Executive Analytics Dashboard. A primeira dobra deve responder: o que chama atenção, quanto vale, quem está envolvido e por que merece explicação.

## Tokens

- Background: `#F5F7FB`
- Surface: `#FFFFFF`
- Soft surface: `#F8FAFC`
- Border: `#E3E8F2`
- Text primary: `#111827`
- Heading: `#070B18`
- Muted: `#667085`
- Primary: `#315CFF`
- Info: `#2F80ED`
- Accent teal: `#12B8A6`
- Danger: `#E63946`
- Warning: `#F97316`
- Success: `#12A980`

## Tipografia

Fonte base: Inter. Numerais usam `font-variant-numeric: tabular-nums`.

## Componentes

- Shell: sidebar branca, topbar leve, conteúdo com largura máxima previsível.
- Cards: superfícies brancas, borda sutil, sombra suave, radius máximo de 8px.
- KPIs: número forte, label curto, nota opcional, sem texto redundante.
- Inputs: labels persistentes, altura mínima 44px, texto escuro em fundo branco, foco azul.
- Tables: cabeçalho baixo, uppercase discreto, linhas com hover sutil e boa densidade.
- Badges: texto sempre presente; cor não é o único indicador.
- Evidence cards: usados apenas para destacar "por que isso preocupa" ou origem.

## Linguagem

- Trocar jargão técnico por nomes naturais.
- Mostrar o fato principal antes de contexto técnico.
- Usar termos como "sinal de alerta", "exige explicação", "merece apuração".
- Não afirmar crime sem prova.
- Evitar repetir o mesmo resumo em blocos diferentes.

## Interação

- Transições de 150 a 300ms.
- Estados de foco sempre visíveis.
- Uma ação principal por bloco.
- Loading usa skeleton ou mensagem curta.
- O usuário deve sempre conseguir voltar para a lista ou origem.

## Anti-patterns

- Não usar dark dashboard como linguagem dominante nesta fase.
- Não usar visual hacker, glow excessivo ou painel escuro pesado.
- Não manter termos como "contexto técnico" quando "origem" ou "dados do contrato" resolvem melhor.
- Não esconder label em placeholder.
- Não reimplementar análise factual no frontend.
- Não misturar redesign visual com mudanças de backend.
