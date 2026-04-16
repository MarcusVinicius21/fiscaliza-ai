# Fiscaliza.AI Design System Master

## Direção

Pattern principal: Investigative Command Center.

Style principal: Premium Tech SaaS com Dimensional Layering, Bento Grid controlado e hierarquia editorial. Glass e aurora aparecem apenas como profundidade discreta, nunca como decoração dominante.

Dashboard style: Executive BI + Comparative Analysis Dashboard. A interface deve priorizar leitura rápida, evidências rastreáveis e próximos passos claros.

## Tokens

- Background: `#070A0F`, `#0A111C`
- Surface: `#101827`, `#131E2F`
- Border: `rgba(148, 163, 184, 0.20)`
- Text: `#F8FAFC`
- Muted: `#A8B3C7`
- Info: `#4EA8DE`
- Cyan highlight: `#7DD3FC`
- Danger: `#E63946`
- Warning: `#F5B84B`
- Success: `#2DD4BF`

## Tipografia

Fonte base: Inter. Numerais usam `font-variant-numeric: tabular-nums`.

## Componentes

- Panels: fundo escuro translúcido, borda visível, radius de até 8px.
- Cards KPI: presença visual, faixa inferior de acento e números tabulares.
- Inputs: labels persistentes, altura mínima 44px, contraste real e foco azul claro.
- Tables: cabeçalho baixo, uppercase discreto, linhas com hover sutil.
- Badges: não dependem só de cor; texto sempre presente.

## Interação

- Transições de 150 a 300ms.
- Estados de foco sempre visíveis.
- Botões principais têm uma única CTA dominante por bloco.
- Loading usa skeleton ou mensagem operacional clara.

## Anti-patterns

- Não usar cards brancos dentro do shell escuro.
- Não usar overrides globais para mascarar páginas antigas.
- Não usar visual hacker, neon agressivo ou roxo/gradiente de IA genérico.
- Não esconder label em placeholder.
- Não reimplementar análise factual no frontend.
- Não misturar redesign visual com mudanças de backend.
