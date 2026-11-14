# implement-u1-plan — docs/PLAN.md

## What I changed

- Created `docs/PLAN.md` (1522 lines) in `tipping-point-app`.
- **Part A**: `sed -n '1,253p' ~/code/r2l2pj/.crew/plan-delta.md` — verbatim,
  byte-for-byte, line 1 through the end of "#### Instruções para o agente dev,
  Modo 1" item 11 ("Pronto quando..."). Stops before the
  "## Delta vs plan-v4.txt" trailer (not included).
- **Required edit**: appended the D8 row to the "Decisões adotadas" table
  (line 21), verbatim text as specified.
- **Part B**: `~/code/r2l2pj/.crew/plan-v4.txt` lines 471–2684, cleaned into
  Markdown in Portuguese, same text. Applied:
  - Removed all `Page N of 50` lines and all mid-content
    `Tipping Point: documento do projeto` running headers.
  - Section titles → `##`, subsections → `###`, "Instruções para o agente dev"
    blocks → `####`, matching Part A depth.
  - Rebuilt 14 PDF-extract tables as proper Markdown tables (Modo 3 metrics,
    níveis preditivos, casos WA×RS, dados GEE, dados fora do GEE, stack, modo
    Agora, roadmap backend, comandos Telegram, conceitos GEE, erros GEE,
    abas do app, cores TPI, outras camadas, gráficos, papéis, cronograma,
    riscos).
  - Code snippets in fenced blocks (`python`, `js`, `sh`, `json`, `text`):
    repo tree, gs:// tree, manifest.json, pipeline diagram, Telegram fluxo,
    alerta message, GEE 5, build_simular.py, telegram.py webhook, curl
    webhook, alerts.py, GEE guide snippets, GEE 1–4, Python 1–5, ASCII app
    layout. Verbatim text; only mechanical fixes (rejoined lines broken
    mid-token by the extract, e.g. `'2025-01-\n01'` → `'2025-01-01'`,
    `landslide_can\ndidates.tif` → `landslide_candidates.tif`, comment word
    `faria` rejoined, indentation re-established to keep code syntactically
    coherent). No sentence rewrites, no reordering, no dropped rows/bullets.
  - LaTeX `TPI = R \times S \times T_{ML}` kept verbatim in inline code.
  - Included everything to EOF: Fluxo do usuário na demo, Time/cronograma/
    entregáveis, Riscos/limitações/roadmap, Limitações README, Roadmap.
- No git commands run. No other files touched besides this report.

## Commands run and results

```
$ sed -n '1,253p' ~/code/r2l2pj/.crew/plan-delta.md > docs/PLAN.md   # Part A
$ cat /tmp/plan_partb.md >> docs/PLAN.md                            # Part B
$ wc -l docs/PLAN.md → 1522 docs/PLAN.md
```

## Self-check outputs

check1 — Page lines (must be empty):
```
$ grep -n 'Page [0-9]* of' docs/PLAN.md
grep_exit=1   (no matches — empty)
```

check2 — fence parity (must be even):
```
$ grep -c '^```' docs/PLAN.md
fence lines: 60
PARITY EVEN
```

check3 — keywords (all OK):
```
OK Modo 2
OK Modo 3
OK Camada de impacto
OK ML
OK Casos de validação
OK Dados NASA
OK Infraestrutura
OK Armazenamento
OK Modo Agora
OK GEE ao vivo
OK Roadmap
OK Layout do app
OK Escalas de cores
OK Regras de visualização
OK Riscos
```

check4 — Part A verbatim:
```
$ diff <(sed -n '1,10p' ~/code/r2l2pj/.crew/plan-delta.md) <(sed -n '1,10p' docs/PLAN.md)
DIFF EMPTY
```

Extra sanity:
```
$ grep -n 'Tipping Point: documento do projeto' docs/PLAN.md
1:# Tipping Point: documento do projeto (plano final)   ← only the H1 title
$ grep -n 'Delta vs' docs/PLAN.md                        ← empty, trailer excluded
$ grep -n 'Decisão D8' docs/PLAN.md
21:| TPI no texto | R × S × T em trechos anteriores ... | Decisão D8 do condutor 2026-11-14 |
$ sed -n '253,258p' docs/PLAN.md → item 11 ends Part A; '## Modo 2...' starts Part B
```
