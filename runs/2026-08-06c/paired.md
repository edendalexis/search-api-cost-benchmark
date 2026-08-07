# Paired comparison, runs/2026-08-06c

Every arm answered the same 100 questions, so the two percentages are not
independent samples. Question by question, the ones both arms get right and the ones
both get wrong say nothing about which is better. Only the disagreements do, and
McNemar's exact test reads them.

**22 of 91 pairs separate at p < 0.05.**

"Not separated" is not "equal": at this sample size the test cannot settle small
gaps. It can only say which gaps the data supports.

## Every pair

| A | B | A % | B % | A right, B wrong | B right, A wrong | p | separated |
|---|---|---:|---:|---:|---:|---:|:-:|
| `you-web` | `firecrawl-search` | 95 | 94 | 5 | 4 | 1.000 | no |
| `you-web` | `exa-search` | 95 | 93 | 6 | 4 | 0.754 | no |
| `you-web` | `brave-search` | 95 | 93 | 4 | 2 | 0.688 | no |
| `you-web` | `serpdive-moby` | 95 | 92 | 7 | 4 | 0.549 | no |
| `you-web` | `exa-highlights` | 95 | 92 | 7 | 4 | 0.549 | no |
| `you-web` | `tavily-advanced` | 95 | 91 | 8 | 4 | 0.388 | no |
| `you-web` | `serpdive-mako` | 95 | 88 | 10 | 3 | 0.092 | no |
| `you-web` | `tavily-basic` | 95 | 88 | 10 | 3 | 0.092 | no |
| `you-web` | `parallel-advanced` | 95 | 87 | 12 | 4 | 0.077 | no |
| `you-web` | `linkup-standard` | 95 | 85 | 12 | 2 | 0.013 | yes |
| `you-web` | `parallel-basic` | 95 | 83 | 14 | 2 | 0.004 | yes |
| `you-web` | `parallel-turbo` | 95 | 79 | 18 | 2 | 0.000 | yes |
| `you-web` | `serpdive-krill` | 95 | 78 | 20 | 3 | 0.000 | yes |
| `firecrawl-search` | `exa-search` | 94 | 93 | 7 | 6 | 1.000 | no |
| `firecrawl-search` | `brave-search` | 94 | 93 | 5 | 4 | 1.000 | no |
| `firecrawl-search` | `serpdive-moby` | 94 | 92 | 8 | 6 | 0.791 | no |
| `firecrawl-search` | `exa-highlights` | 94 | 92 | 8 | 6 | 0.791 | no |
| `firecrawl-search` | `tavily-advanced` | 94 | 91 | 8 | 5 | 0.581 | no |
| `firecrawl-search` | `serpdive-mako` | 94 | 88 | 11 | 5 | 0.210 | no |
| `firecrawl-search` | `tavily-basic` | 94 | 88 | 10 | 4 | 0.180 | no |
| `firecrawl-search` | `parallel-advanced` | 94 | 87 | 12 | 5 | 0.143 | no |
| `firecrawl-search` | `linkup-standard` | 94 | 85 | 13 | 4 | 0.049 | yes |
| `firecrawl-search` | `parallel-basic` | 94 | 83 | 15 | 4 | 0.019 | yes |
| `firecrawl-search` | `parallel-turbo` | 94 | 79 | 19 | 4 | 0.003 | yes |
| `firecrawl-search` | `serpdive-krill` | 94 | 78 | 21 | 5 | 0.002 | yes |
| `exa-search` | `brave-search` | 93 | 93 | 7 | 7 | 1.000 | no |
| `exa-search` | `serpdive-moby` | 93 | 92 | 6 | 5 | 1.000 | no |
| `exa-search` | `exa-highlights` | 93 | 92 | 4 | 3 | 1.000 | no |
| `exa-search` | `tavily-advanced` | 93 | 91 | 7 | 5 | 0.774 | no |
| `exa-search` | `serpdive-mako` | 93 | 88 | 10 | 5 | 0.302 | no |
| `exa-search` | `tavily-basic` | 93 | 88 | 11 | 6 | 0.332 | no |
| `exa-search` | `parallel-advanced` | 93 | 87 | 11 | 5 | 0.210 | no |
| `exa-search` | `linkup-standard` | 93 | 85 | 14 | 6 | 0.115 | no |
| `exa-search` | `parallel-basic` | 93 | 83 | 13 | 3 | 0.021 | yes |
| `exa-search` | `parallel-turbo` | 93 | 79 | 18 | 4 | 0.004 | yes |
| `exa-search` | `serpdive-krill` | 93 | 78 | 20 | 5 | 0.004 | yes |
| `brave-search` | `serpdive-moby` | 93 | 92 | 8 | 7 | 1.000 | no |
| `brave-search` | `exa-highlights` | 93 | 92 | 7 | 6 | 1.000 | no |
| `brave-search` | `tavily-advanced` | 93 | 91 | 8 | 6 | 0.791 | no |
| `brave-search` | `serpdive-mako` | 93 | 88 | 11 | 6 | 0.332 | no |
| `brave-search` | `tavily-basic` | 93 | 88 | 8 | 3 | 0.227 | no |
| `brave-search` | `parallel-advanced` | 93 | 87 | 13 | 7 | 0.263 | no |
| `brave-search` | `linkup-standard` | 93 | 85 | 13 | 5 | 0.096 | no |
| `brave-search` | `parallel-basic` | 93 | 83 | 13 | 3 | 0.021 | yes |
| `brave-search` | `parallel-turbo` | 93 | 79 | 18 | 4 | 0.004 | yes |
| `brave-search` | `serpdive-krill` | 93 | 78 | 18 | 3 | 0.001 | yes |
| `serpdive-moby` | `exa-highlights` | 92 | 92 | 6 | 6 | 1.000 | no |
| `serpdive-moby` | `tavily-advanced` | 92 | 91 | 7 | 6 | 1.000 | no |
| `serpdive-moby` | `serpdive-mako` | 92 | 88 | 9 | 5 | 0.424 | no |
| `serpdive-moby` | `tavily-basic` | 92 | 88 | 10 | 6 | 0.454 | no |
| `serpdive-moby` | `parallel-advanced` | 92 | 87 | 10 | 5 | 0.302 | no |
| `serpdive-moby` | `linkup-standard` | 92 | 85 | 13 | 6 | 0.167 | no |
| `serpdive-moby` | `parallel-basic` | 92 | 83 | 13 | 4 | 0.049 | yes |
| `serpdive-moby` | `parallel-turbo` | 92 | 79 | 20 | 7 | 0.019 | yes |
| `serpdive-moby` | `serpdive-krill` | 92 | 78 | 20 | 6 | 0.009 | yes |
| `exa-highlights` | `tavily-advanced` | 92 | 91 | 6 | 5 | 1.000 | no |
| `exa-highlights` | `serpdive-mako` | 92 | 88 | 9 | 5 | 0.424 | no |
| `exa-highlights` | `tavily-basic` | 92 | 88 | 10 | 6 | 0.454 | no |
| `exa-highlights` | `parallel-advanced` | 92 | 87 | 12 | 7 | 0.359 | no |
| `exa-highlights` | `linkup-standard` | 92 | 85 | 12 | 5 | 0.143 | no |
| `exa-highlights` | `parallel-basic` | 92 | 83 | 13 | 4 | 0.049 | yes |
| `exa-highlights` | `parallel-turbo` | 92 | 79 | 19 | 6 | 0.015 | yes |
| `exa-highlights` | `serpdive-krill` | 92 | 78 | 19 | 5 | 0.007 | yes |
| `tavily-advanced` | `serpdive-mako` | 91 | 88 | 8 | 5 | 0.581 | no |
| `tavily-advanced` | `tavily-basic` | 91 | 88 | 10 | 7 | 0.629 | no |
| `tavily-advanced` | `parallel-advanced` | 91 | 87 | 10 | 6 | 0.454 | no |
| `tavily-advanced` | `linkup-standard` | 91 | 85 | 13 | 7 | 0.263 | no |
| `tavily-advanced` | `parallel-basic` | 91 | 83 | 11 | 3 | 0.057 | no |
| `tavily-advanced` | `parallel-turbo` | 91 | 79 | 16 | 4 | 0.012 | yes |
| `tavily-advanced` | `serpdive-krill` | 91 | 78 | 21 | 8 | 0.024 | yes |
| `serpdive-mako` | `tavily-basic` | 88 | 88 | 8 | 8 | 1.000 | no |
| `serpdive-mako` | `parallel-advanced` | 88 | 87 | 11 | 10 | 1.000 | no |
| `serpdive-mako` | `linkup-standard` | 88 | 85 | 10 | 7 | 0.629 | no |
| `serpdive-mako` | `parallel-basic` | 88 | 83 | 11 | 6 | 0.332 | no |
| `serpdive-mako` | `parallel-turbo` | 88 | 79 | 16 | 7 | 0.093 | no |
| `serpdive-mako` | `serpdive-krill` | 88 | 78 | 18 | 8 | 0.076 | no |
| `tavily-basic` | `parallel-advanced` | 88 | 87 | 10 | 9 | 1.000 | no |
| `tavily-basic` | `linkup-standard` | 88 | 85 | 12 | 9 | 0.664 | no |
| `tavily-basic` | `parallel-basic` | 88 | 83 | 13 | 8 | 0.383 | no |
| `tavily-basic` | `parallel-turbo` | 88 | 79 | 15 | 6 | 0.078 | no |
| `tavily-basic` | `serpdive-krill` | 88 | 78 | 19 | 9 | 0.087 | no |
| `parallel-advanced` | `linkup-standard` | 87 | 85 | 10 | 8 | 0.815 | no |
| `parallel-advanced` | `parallel-basic` | 87 | 83 | 10 | 6 | 0.454 | no |
| `parallel-advanced` | `parallel-turbo` | 87 | 79 | 15 | 7 | 0.134 | no |
| `parallel-advanced` | `serpdive-krill` | 87 | 78 | 20 | 11 | 0.150 | no |
| `linkup-standard` | `parallel-basic` | 85 | 83 | 10 | 8 | 0.815 | no |
| `linkup-standard` | `parallel-turbo` | 85 | 79 | 16 | 10 | 0.327 | no |
| `linkup-standard` | `serpdive-krill` | 85 | 78 | 17 | 10 | 0.248 | no |
| `parallel-basic` | `parallel-turbo` | 83 | 79 | 12 | 8 | 0.503 | no |
| `parallel-basic` | `serpdive-krill` | 83 | 78 | 17 | 12 | 0.458 | no |
| `parallel-turbo` | `serpdive-krill` | 79 | 78 | 14 | 13 | 1.000 | no |

Regenerate with `node bin/paired.mjs --run=runs/2026-08-06c`. It calls no model.
