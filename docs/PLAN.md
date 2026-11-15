# Tipping Point: documento do projeto (plano final)

Nov 14, 2026. Fonte: documento do projeto v4 (Claude Docs), copiado aqui como plano final do time. Este arquivo é o mesmo nos dois repositórios (`tipping-point-data/docs/PLAN.md` e `tipping-point-app/docs/PLAN.md`).

## Decisões adotadas que substituem o texto abaixo

O texto original segue inalterado depois desta seção. Onde ele diverge, vale esta tabela.

| Tema | Documento diz | Adotado | Por quê |
| --- | --- | --- | --- |
| Coleção SMAP | `NASA/SMAP/SPL4SMGP/007` | `NASA/SMAP/SPL4SMGP/008` | /007 foi descontinuada |
| Modelo de ML (nível 3) | `ee.Classifier.smileRandomForest` no GEE | XGBoost offline em `ml/` com restrições monotônicas e CV por blocos espaciais | Decisão verificada; métrica continua sendo AUC por blocos |
| Repositórios | Um repo `tipping-point/` com `gee/ python/ data/ app/` | Dois repos: `tipping-point-data` (Python/uv: `pipeline/ ml/ gee/ live/ tools/`) e `tipping-point-app` (Next.js 16 + bun + Tailwind + MapLibre v6) | Times de dados e front trabalham em paralelo; `bun run sync:data` leva `data/` para o app |
| Front | React + Vite + georaster + Recharts | Next.js 16 (Cache Components) + MapLibre v6 | Já construído; rotas `/` (ops) e `/alerts` |
| Contrato de dados | `manifest.json` com `layers[{id,date,png,cog,legend}]` | Manifest v4 na raiz: `cases/{mode,bounds,layers[png,cog,bounds,legend]}`; PNG em EPSG:3857, COG/GeoJSON em EPSG:4326; manifest gravado por último | Igual à intenção do documento, com `bounds` por camada |
| NISAR deslizamento | "cicatrizes" | Sempre "candidatos", nunca "confirmados" | Regra de visualização 7 |
| Credenciais | Earthdata, SA do GEE, Telegram | Só em variáveis de ambiente e secrets; a chave da SA fica fora dos repos | Regra geral 6 |
| Previsão no Replay (nível 2) | GEOS-FP emitido antes do evento | "Previsão perfeita": IMERG observado como previsão D+1..D+3, rotulado no app e no README, `forecast_source=perfect-forecast`. Modo Agora segue com GEOS-FP do dia | Arquivo público do GEOS-FP guarda só ~2 semanas (research r-geosfp); decisão do Lucas 2026-11-14 |
| Deslizamento no caso wa_2025 | Candidatos por queda de coerência GUNW | Radar confirma só enchente (GCOV 172D/064: 10 nov, 4 dez, 16 dez de 2025). Candidatos a cicatriz vêm do HLS óptico pós-evento quando a nuvem abrir, sempre "candidatos"; falta de par GUNW cruzando o evento declarada como limitação | Único GUNW público é 10→22 nov, antes do evento (research r-nisar); decisão do Lucas 2026-11-14 |
| Projeto GEE | `tipping-point-xxx` | `hermes-fesolucoes` (ainda não registrado no Earth Engine) | Bloqueio humano |
| TPI no texto | R × S × T em trechos anteriores ao Modo 1 | TPI é a média geométrica (ponderada) em todo o documento; onde o texto antigo diz R × S × T, leia (R·S·T)^(1/3) | Decisão D8 do condutor 2026-11-14 |
| Layout de dados | Pastas por id de evento / layout antigo do SCHEMA | Pastas por case id (`data/rs_2024/`, `data/wa_2025/`, `data/now/`, `data/static/`), um `metrics.json` raiz referenciado como `metrics.json#<case_id>`, manifest por último — substitui E1 e as pastas por event id | Decisão do Lucas 2026-11-14 (L4) |
| Popup R/S/T | Popup sem leitura dos COGs por caso | Nova dep `geotiff`; data side publica COGs por caso (R/S diários, T_slide/T_flood estáticos, TPI multibanda com uma banda por dia, nome YYYYMMDD, EPSG:4326) no manifest para range-read do popup (município, classe TPI, R, S, T, data), substituindo o popup anterior; L10 limita range-read aos COGs presentes no fallback | L5 + L10 |
| Autenticação Earthdata | `EDL_USER`/`EDL_PASS` | Bearer `EARTHDATA_TOKEN` substitui usuário/senha (~60 dias, renovar antes do fim do julgamento; `EDL_*` só fallback local, nunca em secrets) | L6 |
| Dados fora do catálogo GEE | Dados externos analisados fora do GEE | Dados fora do catálogo viram assets em `projects/<GEE_PROJECT>/assets/tipping-point/<case>/` e a análise roda no GEE, substituindo a análise externa; ficam fora SWOT Hydrocron JSON, GEOS-FP e o job Modo Agora; ingestão sem bucket conforme L10 | L7 + L10 |
| Arquitetura | App lê arquivos/bucket | Assets GEE = fonte única da verdade; jobs agendados atualizam assets; app lê GEE via API routes com cache; export last-good estático por atualização e fallback mostrando a data dos dados, substituindo a leitura primária de arquivos/bucket | L8 |
| Cobertura operacional | Cobertura global no Modo Agora | Modo Agora e dados operacionais limitados ao Sul do Brasil (RS/SC/PR, `config.yaml domains.now.bbox`), substituindo a cobertura global; casos replay ficam; cobertura global é mudança de config no lançamento | L9 |
| Armazenamento sem bucket GCS | Bucket GCS público | Sem bucket, substitui D2 e os trechos de bucket de L4/L7/L8: vetores via FeatureCollection e `Export.table.toAsset`; rasters processados em Python, só derivados sobem; fallback pequeno, sem COGs grandes, no branch órfão `fallback` do `tipping-point-data` via `raw.githubusercontent.com` (`DATA_BASE_URL`); export direto, sem staging/IAM/lifecycle; popup consulta ponto no GEE, range-read só com COG no fallback | L10 |
| Custos | Runtime com serviços sem restrição de plano | Todo runtime em free tier: GEE não-comercial, GitHub Actions, GitHub raw, Vercel Hobby, Earthdata, Telegram Bot API, Neon free — substitui qualquer serviço pago | L11 + L12b |
| Banco de dados (Telegram) | Firestore | Neon Postgres free via endpoint HTTPS SQL (`POST <host>/sql`, header `Neon-Connection-String`, `{query,params}`) com fetch/requests puros, sem dependência nova — se o endpoint provar não documentado ou não confiável, pedir ao condutor antes de adicionar driver; substitui Firestore e Supabase; mesma tabela `subscribers`; acesso só server-side; secret `DATABASE_URL`; regras LGPD inalteradas | L12 + L12b |
| Cadência de atualização | Modo Agora a cada 3 h | `now.yml` a cada 3 h (`0 */3 * * *`) + dispatch; `nisar.yml` e `validation.yml` diários; `reference.yml` semanal + dispatch; app diz "updated X h ago" e o aviso de dado velho após 6 h (2 runs perdidos) | L13b, substitui L13 |
| Cobertura e pitch | Cobertura global | Começa pelo Sul do Brasil (RS/SC/PR) nos dados e em todo o pitch/caso — RS 2024 é a história principal, WA 2025 só como prova de radar; cobertura global só no lançamento (uma edição de config, L9) | L9b, Lucas 2026-11-14 |
| Texto da submissão | frase-tema própria / lead-time só com mediana completa | frase-tema = a frase do documento verbatim ('...confirm where the ground actually moved or flooded...'); headline de lead-time = 'Tipping Point would have warned X hours earlier' (X = mediana), mantendo mediana + IQR + n + 'in replay' como detalhe de suporte (card, nota de rodapé do slide, README) | L18, Lucas 2026-11-14; revisão dos rascunhos na manhã de 2026-11-15 |
| Idioma da UI | Regra 8: inglês para os juízes | Inglês para os juízes: "Did we get it right?", "perfect forecast", "forecast"; substitui rótulos em português, nomes próprios no original | C1, condutor 2026-11-14 |
| Fontes extras de validação | Só dados NASA | Só validação/contexto, nunca entrada do índice: API NOAA NWS (horário dos avisos oficiais em WA, `official_warning_delta_h`), estações INMET no RS abr–mai 2024 como checagem do IMERG (`imerg_vs_gauge`), gráficos NASA Giovanni se houver tempo; ANA HidroWeb fica no roadmap | L19, Lucas 2026-11-14 |
| TPI do Modo Agora | TPI calculado no GEE | Calculado localmente (numpy, desenho original do Modo Agora) a partir dos recortes baixados de IMERG Early, SMAP e previsão; sem ingestão de raster ao vivo; estáticos e só os doys de climatologia necessários vêm das cópias exportadas (L25) | L20 + L25 |
| Faturamento GCP | Bucket GCS | Sem billing no GCP (reabrir exigia ~R$170): sem bucket GCS; L10 e L20 continuam valendo | L21, Lucas 2026-11-14 |
| Previsão no Replay (nível 2), substitui "Previsão perfeita" | GEOS-FP emitido antes do evento | Previsão real emitida no dia. Não há arquivo NASA de previsão para as duas janelas, então NOAA GFS 0,25° (única entrada não-NASA declarada), rotulado "forecast · NOAA GFS (issued <date>)". Em cada dia de emissão D (00Z): R = IMERG observado até D−1 + GFS da rodada D, S fixo no último SMAP disponível em D, T estático; quadro "D+k" = chuva de 3 dias terminando em D+k. Nova métrica: lead time de previsão (mediana, IQR, n) ao lado do lead time observado. Previsão perfeita fica só como limite superior rotulado, nunca headline | L22 + L28b, Lucas 2026-11-14/15 |
| Georreferência do GFS | — | Vale o GRIB bruto da NOAA (lido via GDAL/rasterio, sem cfgrib/eccodes); o `NOAA/GFS0P25` do GEE está uma linha (0,25°) deslocado. COGs do Replay regenerados do GRIB no AWS; números de lead time de previsão anteriores são provisórios até o rebuild | L28, condutor 2026-11-15 |
| Modelo de gatilho (nível 3b) | Random Forest no GEE | XGBoost local (`ml/`) dá P(deslizamento em 24/48/72 h, 7 e 14 dias) com chuva antecedente + solo + terreno + chuva prevista GFS; validação por blocos espaciais / evento deixado de fora, calibrado; prova = XGBoost vs Random Forest sklearn vs limiar TPI > 0,6 no mesmo conjunto (precision, recall, F1, accuracy, matriz de confusão, taxa base, PR-AUC, ROC-AUC). TPI continua o índice principal; rotas de modelo no GEE descartadas | L23 + L24 + L25 + L27 |
| GEE em tempo de execução | GEE no caminho de runtime | GEE só para cópias hospedadas e cálculo pontual; nenhum caminho de runtime (app, job do Modo Agora, modelo) usa GEE — risco da cota não-comercial no julgamento. Fontes diretas via `EARTHDATA_TOKEN` (GES DISC, NSIDC, LP DAAC, SEDAC, LAADS, PO.DAAC, ASF) e GFS da NOAA no AWS (`noaa-gfs-bdp-pds`); overlay GEE no app desligado por padrão (flag de ambiente). Substitui L8 e a parte GEE de L20 | L25, Lucas 2026-11-14 |
| Armazenamento dos dados publicados | Bucket / Neon Object Storage (L17) | Branch `fallback` do repo público `r2l2pj/tipping-point-data` é a leitura PRIMÁRIA do app (`raw.githubusercontent.com`); Neon Object Storage vira fallback (Neon Postgres segue com os inscritos). `now.yml` publica a cada 3 h um commit órfão force-pushed (sem crescer histórico), só arquivos do app, manifest por último; arquivo > 50 MB vai para GitHub Release | L26, Lucas 2026-11-15 |
| Foco do produto | Previsão primeiro | Resposta primeiro, previsão depois: consciência situacional em tempo real para a Defesa Civil durante o desastre (onde alagou ou deslizou agora, quem foi afetado, o que mudou desde a última passagem; a cada 3 h, horário de Brasília); depois previsão (TPI + P(gatilho) do modelo; 7 e 14 dias rotulados "low forecast skill") | L27, Lucas 2026-11-15 |
| Regiões | Analisar qualquer lugar escolhido | Sem "escolha um lugar": regiões configuradas à mão (`config.yaml` domains/cases) e só onde há dados preparados (Sul do Brasil ao vivo; Replay RS 2024 e WA 2025); o app nunca busca dado novo para lugar não configurado e lista só as regiões do manifest | L29, Lucas 2026-11-15 |
| Chuva prevista (Replay e Agora) | GEOS-FP no Modo Agora | NOAA GFS 0,25° nos dois modos, um só modelo de previsão, para que a validação do Replay ("how early") meça o modelo que a visão ao vivo usa; é a única entrada não-NASA, todas as observações (IMERG, SMAP, NISAR, OPERA, NASADEM, GPW, Black Marble) são NASA; GEOS-FP não é mais usado — substitui "Modo Agora segue com GEOS-FP do dia" | L30, Lucas 2026-11-15 |

## Resumo executivo

Tipping Point avisa quando a chuva leva uma encosta ou um bairro ao ponto de virada e usa radar para confirmar onde o terreno cedeu ou alagou. Tudo com dados abertos da NASA.

| Item | Definição |
| --- | --- |
| Projeto | Tipping Point |
| Subtítulo | Rain warns. Radar confirms. |
| Desafio oficial | Dancing with the SARs (NASA Space Apps 2026) |
| Usuário | Defesa Civil municipal |
| Pergunta que responde | A chuva passou do ponto de virada? Onde o terreno já cedeu? |
| Missões NASA | GPM (chuva), SMAP (solo), NISAR (superfície) |
| Hazards | Deslizamento e enchente |
| Prêmios-alvo | Best Use of Data, Local Impact, Galactic Impact |

Frase-tema (submissão): Tipping Point turns NASA rainfall and soil moisture data into a near real-time landslide and flood warning, then uses NISAR radar to confirm where the ground actually moved or flooded, so civil defense teams know where to act first.

Pitch em uma linha: three NASA missions, three layers, one tipping point. Tipping Point prevê, avisa e confirma.

## Siglas

| Sigla | Significado | O que é no projeto |
| --- | --- | --- |
| TPI | Tipping Point Index | Índice do projeto, de 0 a 1, média geométrica de R, S e T |
| R, S, T | Rain, Soil, Terrain | Notas de chuva, solo e terreno que compõem o TPI |
| GPM | Global Precipitation Measurement | Missão NASA de medição de chuva |
| IMERG | Integrated Multi-satellitE Retrievals for GPM | Produto de chuva do GPM, a cada 30 min, desde 2000 |
| SMAP | Soil Moisture Active Passive | Missão NASA de umidade do solo |
| NISAR | NASA-ISRO Synthetic Aperture Radar | Satélite de radar banda L que confirma o dano |
| SAR | Synthetic Aperture Radar | Radar de abertura sintética, enxerga através de nuvens |
| InSAR | Interferometric SAR | Técnica que compara duas imagens SAR para medir movimento do terreno |
| GCOV | Geocoded Polarimetric Covariance | Produto NISAR de brilho do radar (backscatter), usado para enchente |
| GUNW | Geocoded Unwrapped Interferogram | Produto NISAR de interferograma com coerência, usado para deslizamento |
| dB | Decibel | Escala logarítmica do backscatter |
| NASADEM | NASA Digital Elevation Model | Modelo de elevação NASA, reprocessamento do SRTM |
| SRTM | Shuttle Radar Topography Mission | Missão NASA de 2000 que mapeou o relevo global |
| HAND | Height Above Nearest Drainage | Altura acima da drenagem mais próxima, indica áreas que alagam |
| MERIT Hydro | Multi-Error-Removed Improved-Terrain Hydrography | Base hidrográfica usada só para validar o proxy de HAND |
| LHASA | Landslide Hazard Assessment for Situational Awareness | Modelo de deslizamentos da NASA |
| GLC / COOLR | Global Landslide Catalog / Cooperative Open Online Landslide Repository | Catálogo NASA de deslizamentos usado para treino e validação |
| OPERA | Observational Products for End-Users from Remote Sensing Analysis | Projeto do JPL com produtos prontos de água superficial |
| DSWx | Dynamic Surface Water Extent | Produto OPERA de mapa de água |
| HLS | Harmonized Landsat and Sentinel-2 | Imagens ópticas Landsat e Sentinel-2 harmonizadas pela NASA |
| SWOT | Surface Water and Ocean Topography | Missão NASA e CNES que mede o nível de rios |
| MODIS | Moderate Resolution Imaging Spectroradiometer | Sensor dos satélites Terra e Aqua |
| VIIRS | Visible Infrared Imaging Radiometer Suite | Sensor que gera o Black Marble (luzes noturnas) |
| LANCE | Land, Atmosphere Near real-time Capability for EOS | Serviço NASA de dados em tempo quase real |
| GEOS-FP | Goddard Earth Observing System Forward Processing | Modelo de previsão do tempo da NASA GMAO |
| GMAO | Global Modeling and Assimilation Office | Escritório de modelagem da NASA |
| GPW | Gridded Population of the World | Grade de população do NASA SEDAC |
| SEDAC | Socioeconomic Data and Applications Center | Centro de dados socioeconômicos da NASA |
| DAAC | Distributed Active Archive Center | Centros de arquivo de dados da NASA (ASF, PO.DAAC, LP DAAC) |
| ASF | Alaska Satellite Facility | DAAC que distribui os dados NISAR |
| PO.DAAC | Physical Oceanography DAAC | DAAC que distribui OPERA DSWx e SWOT |
| GEE | Google Earth Engine | Plataforma de processamento de imagens |
| COG | Cloud Optimized GeoTIFF | Formato de raster lido direto pelo app |
| RF | Random Forest | Modelo de machine learning usado no nível 3 |
| AUC | Area Under the Curve | Métrica de acerto do modelo de ML |
| IoU | Intersection over Union | Sobreposição entre dois mapas, de 0 a 1 |
| F1 | F1 score | Média entre precisão e sensibilidade de um mapa |

## O problema

Enchentes são o desastre natural que mais atinge pessoas no planeta. Em maio de 2024, o Rio Grande do Sul viveu a maior da sua história. O nosso time é de lá.

### No mundo

- 250 milhões de pessoas são atingidas por enchentes em média a cada ano, segundo o UNDRR (Fórum Econômico Mundial).
- De 1990 a 2022 foram 4.713 enchentes em 168 países, com mais de 3,2 bilhões de atingidos, 218 mil mortes e mais de US$ 1,3 trilhão em perdas (Bulletin of the WHO).
- O custo cresce. Cinco das dez enchentes mais caras desde 1900 aconteceram depois de 2010 (Statista).

### No Brasil

- 8,2 milhões de brasileiros vivem em áreas de risco de deslizamento, inundação e enxurrada em 825 municípios monitorados pelo Cemaden. Mais de 2,5 milhões estão em áreas de alto risco (Revista Oeste, dados Cemaden).
- O Sul tem 15,6% da sua área com suscetibilidade muito alta a deslizamentos, segundo o IBGE (Vermelho, dados IBGE).

### No Sul, onde o time vive

Em abril e maio de 2024, a chuva parou o Rio Grande do Sul.

| Indicador | Valor |
| --- | --- |
| Municípios atingidos | 446 de 497 (Aos Fatos) |
| Moradores atingidos | 6,3 milhões, segundo o IBGE (Sul21) |
| Mortos e desaparecidos | 185 mortos e 23 desaparecidos (Brasil de Fato) |
| Resgatados | 77.712 pessoas |
| Desalojados e desabrigados | 581.638 desalojados e 81.170 desabrigados |
| Prejuízo estimado | R$ 88,9 bilhões, segundo a CEPAL (UFRGS) |

- Quem mais sofre é quem tem menos. 87% das famílias atingidas ganham até dois salários mínimos.
- A cidade parou. O aeroporto Salgado Filho ficou alagado e sem operar por cerca de cinco meses (Brasil de Fato).
- Não foi um caso isolado. De 1991 a 2022 o estado registrou 3.030 desastres hidrológicos.

### A lacuna

Vimos de perto o que falta na hora crítica.

- O alerta diz onde pode acontecer, não onde aconteceu. Avisos cobrem municípios inteiros. Nas primeiras horas, ninguém sabe quais encostas cederam ou quais bairros alagaram.
- A mesma chuva não tem o mesmo efeito. Solo encharcado cede com menos chuva, e um alerta que olha só para a chuva perde esse contexto.
- O satélite óptico fica cego. Durante a tempestade a região está coberta de nuvem, e o dano só aparece nas imagens dias depois.
- As primeiras horas definem o resgate. Sem saber onde agir, as equipes se espalham e chegam tarde onde mais importa.

Tipping Point nasce dessa lacuna: ligar o alerta (antes) à confirmação do dano (depois), mesmo com nuvem, com dados abertos da NASA.

## A solução

Tipping Point combina três missões NASA, do céu ao chão, para avisar antes e confirmar depois.

| Camada | Missão NASA | Pergunta |
| --- | --- | --- |
| Céu | GPM (IMERG) | Quanta chuva caiu, comparada ao histórico do local? |
| Solo | SMAP | O solo já estava saturado? |
| Superfície | NISAR | Onde o terreno se moveu ou alagou? |

### Proposta de valor

1. Alerta mais esperto. O índice junta chuva, umidade do solo e terreno. Mesma lógica do LHASA, o modelo de deslizamentos da NASA.
2. Confirmação através das nuvens. O radar NISAR (banda L) vê o chão com chuva, nuvem e à noite.
3. Prova de que funciona. Validação com dados NASA independentes: OPERA, SWOT, MODIS e o catálogo global de deslizamentos.
4. Impacto em números. Pessoas expostas, km² alagados e apagão, prontos para a decisão.

Para a demo do hackathon o sistema roda em modo replay sobre um evento real. O app mostra como teria funcionado em tempo real. O pipeline operacional fica no roadmap.

## Como funciona

O sistema tem três modos em sequência (alerta, confirmação e validação) e uma camada de impacto que fecha a história. O diagrama de arquitetura está na seção de infraestrutura.

### Instruções gerais para o agente dev

Cada módulo abaixo termina com um bloco de instruções para o agente dev. Antes de qualquer módulo, siga estas convenções.

1. Configuração única. Leia área, datas e limiares de config.yaml na raiz do repositório. Nunca escreva coordenadas, datas ou limiares soltos no código.
2. Casos. Suporte dois casos, rs_2024 e wa_2025, cada um com aoi (bbox em graus), event_date, window_before_days e window_after_days.
3. Projeção e grade. Saídas em EPSG:4326. TPI e camadas de 10 km reamostradas para a grade do NASADEM (cerca de 30 m) só na combinação final. Rasters NISAR ficam na grade nativa do produto.
4. Formatos. Rasters em COG (data/cog/), polígonos em GeoJSON (data/geojson/), métricas em data/metrics.json, séries em JSON (data/series/).
5. Nomes de arquivo. `<caso>_<camada>_<AAAAMMDD>.tif`, por exemplo rs_2024_tpi_slide_20240502.tif.
6. Credenciais. Earthdata em variáveis de ambiente (EDL_USER, EDL_PASS) ou .netrc. Nunca no repositório.
7. Dados brutos. Baixe em data/raw/ e coloque essa pasta no .gitignore.
8. Só dados NASA como entrada. MERIT Hydro só como referência de validação.
9. Reprodutibilidade. Fixe sementes aleatórias (seed = 42) e registre versões das coleções usadas em data/metrics.json.
10. Definition of done de cada módulo. Arquivos gerados nos caminhos acima, um teste rápido que abre cada arquivo e confere faixa de valores, e uma linha no README dizendo como rodar.

Exemplo de config.yaml:

```yaml
cases:
  rs_2024:
    aoi: [-52.5, -30.5, -50.5, -29.0]   # oeste, sul, leste, norte
    event_date: 2024-05-02
    window_before_days: 10
    window_after_days: 5
  wa_2025:
    aoi: [-122.6, 47.0, -121.5, 48.5]
    event_date: 2025-12-10
    window_before_days: 10
    window_after_days: 10
thresholds:
  rain_percentiles: [90, 95, 99]
  soil_wetness_range: [0.5, 0.9]
  slope_range_deg: [15, 30]
  hand_range_m: [5, 15]
  hand_proxy_radius_m: 1500
  tpi_classes: [0.2, 0.4, 0.6]
  flood_db_drop: -3
  water_db_max: -15
  coherence_drop: 0.3
  coherence_ref_min: 0.4
  min_blob_pixels: 10
seed: 42
```

### Modo 1. Alerta, o Tipping Point Index (GEE)

Cada pixel recebe três notas normalizadas de 0 a 1. O índice é a média geométrica delas, que também fica entre 0 e 1.

```latex
\mathrm{TPI} = \left( R \cdot S \cdot T \right)^{1/3}, \qquad R,\, S,\, T \in [0, 1] \;\Rightarrow\; \mathrm{TPI} \in [0, 1]
```

Por que média geométrica e não o produto simples. O produto de três notas entre 0 e 1 comprime a escala: três notas de 0,8 dão 0,51, e a área cairia em Alto em vez de Crítico. A média geométrica mantém a escala (três notas de 0,8 dão 0,8) e preserva a lógica de que os três fatores são necessários: se qualquer um for zero, o TPI é zero.

Versão com pesos (opcional). Com pesos que somam 1, o TPI continua entre 0 e 1. O padrão é 1/3 para cada fator. Os pesos podem vir da importância das variáveis do Random Forest e ficam em config.yaml como tpi_weights.

```latex
\mathrm{TPI} = R^{\,w_R} \, S^{\,w_S} \, T^{\,w_T}, \qquad w_R + w_S + w_T = 1
```

Notas normalizadas. Todas usam a função de corte entre 0 e 1:

```latex
\operatorname{clip}(x) = \min\left(\max(x,\, 0),\, 1\right)

R = \begin{cases} 0 & P_3 < P_{90} \\ 0.5 \, \dfrac{P_3 - P_{90}}{P_{95} - P_{90}} & P_{90} \le P_3 < P_{95} \\ 0.5 + 0.5 \, \dfrac{P_3 - P_{95}}{P_{99} - P_{95}} & P_{95} \le P_3 < P_{99} \\ 1 & P_3 \ge P_{99} \end{cases}

S = \operatorname{clip}\left( \frac{\theta - 0.5}{0.9 - 0.5} \right)

T_{\text{desl}} = \operatorname{clip}\left( \frac{\beta - 15^\circ}{30^\circ - 15^\circ} \right)

H(x) \approx z(x) - \min_{\lVert x' - x \rVert \le r} z(x'), \qquad T_{\text{ench}} = \operatorname{clip}\left( 1 - \frac{H - 5}{15 - 5} \right) \cdot \mathbb{1}\left[\beta \le 5^\circ\right]
```

Onde: P₃ é a chuva acumulada em 3 dias (mm); P₉₀, P₉₅ e P₉₉ são os percentis da climatologia do próprio pixel na mesma época do ano; θ é a umidade da zona radicular do SMAP (0 a 1); β é a declividade do NASADEM (graus); z é a altitude do NASADEM (m); H é o proxy de HAND (m); r é o raio do proxy (1.500 m por padrão); 𝟙[·] vale 1 quando a condição é verdadeira e 0 quando é falsa.

| Nota | Dado | Regra inicial |
| --- | --- | --- |
| R, chuva | IMERG, acumulado de 3 dias (o de 7 dias aparece só no gráfico) | Percentil do próprio pixel na série 2001 a 2025. Abaixo de P90 = 0, P95 = 0,5, acima de P99 = 1 |
| S, solo | SMAP L4, banda sm_rootzone_wetness | Já vem de 0 a 1. Acima de 0,8 = praticamente saturado |
| T deslizamento | NASADEM, LHASA, MODIS Land Cover | Declividade acima de 30° = 1, de 15° a 30° = 0,5, abaixo de 15° = 0. Ajuste pela classe LHASA e uso do solo |
| T enchente | Proxy de HAND no NASADEM | Altitude menos a mínima num raio de 1,5 km, validado contra o HAND do MERIT Hydro. Abaixo de 5 m = 1, de 5 a 15 m = 0,5 |

| TPI | Classe |
| --- | --- |
| 0 a 0,2 | Baixo |
| 0,2 a 0,4 | Moderado |
| 0,4 a 0,6 | Alto |
| acima de 0,6 | Crítico (tipping point) |

Os limiares são ponto de partida. Calibrar com o evento escolhido e documentar no README.

#### Instruções para o agente dev, Modo 1 (gee/01_rain.js a gee/04_tpi.js)

1. Entradas: NASA/GPM_L3/IMERG_V07 (banda precipitation, mm/h a cada 30 min), NASA/SMAP/SPL4SMGP (banda sm_rootzone_wetness, versão mais recente), NASA/NASADEM_HGT/001 (banda elevation), MODIS/061/MCD12Q1 (banda LC_Type1).
2. Chuva acumulada: some IMERG na janela e multiplique por 0,5 para obter mm. Calcule 3 dias para o índice e 7 dias só para o gráfico.
3. Climatologia: para 2001 a 2023, janelas de 3 dias a cada 3 dias, de 30 dias antes a 30 dias depois do mesmo dia do ano do evento. Reduza com percentis 90, 95 e 99. Exporte como asset uma vez e reutilize.
4. Nota R: 0 abaixo de P90, linear de 0 a 0,5 entre P90 e P95, linear de 0,5 a 1 entre P95 e P99, 1 acima de P99. Proteja contra divisão por zero quando P95 for igual a P90.
5. Nota S: média de sm_rootzone_wetness nas 24 h anteriores, reescalada de 0,5 a 0,9 para 0 a 1.
6. Nota T deslizamento: declividade reescalada de 15° a 30° para 0 a 1. Se o nível 3a estiver pronto, use T_ml no lugar.
7. Nota T enchente: proxy de HAND com o raio de config.yaml, invertido e reescalado de 5 a 15 m. Zere onde a declividade passar de 5°.
8. TPI: TPI_slide = (R × S × T_slide)^(1/3) e TPI_flood = (R × S × T_flood)^(1/3). Classes com os cortes 0,2, 0,4 e 0,6.
9. Série: gere o TPI para cada dia da janela do caso e exporte um COG multibanda por camada, uma banda por dia, com o nome da banda igual à data.
10. Saídas: data/cog/<caso>_tpi_slide_series.tif, data/cog/<caso>_tpi_flood_series.tif e data/series/<caso>_rain_soil.json com chuva e umidade médias da área por dia.
11. Pronto quando: todos os valores do TPI estão entre 0 e 1, a série tem uma banda por dia da janela, e o pico do TPI cai na data do evento ou antes dela.

## Modo 2. Confirmação com NISAR (Python)

### Enchente, produto GCOV (backscatter)

1. Par antes e depois do evento, recortado na área.
2. Razão em dB entre as datas.
3. Pixel alagado quando a queda passa de 3 dB e o valor depois fica abaixo de cerca de -15 dB (água é escura no radar).
4. Remover água permanente, ou seja, a que já existia antes.

### Deslizamento, produto GUNW (coerência)

1. Comparar a coerência de um par sem evento com a de um par que cruza o evento.
2. Candidato a deslizamento quando a coerência cai mais de 0,3 em encosta acima de 15°.
3. Remover vegetação densa e filtrar manchas pequenas.

Saída: polígonos de enchente confirmada e de cicatrizes candidatas, em GeoJSON.

#### Instruções para o agente dev, Modo 2 (python/01_get_nisar.py a python/03_landslide_coh.py)

1. Busca: use asf_search com a área e a janela do caso wa_2025. Liste track, frame, data e nível de cada produto. Escolha o par GCOV antes e depois do pico no mesmo track e frame.
2. Coerência: escolha dois GUNW do mesmo track e frame, um par sem evento (as duas datas antes do pico) e um par que cruza o pico.
3. Leitura: os produtos são HDF5. Confira os caminhos internos das camadas no NISAR Data User Guide antes de codificar, e registre os caminhos usados no README.
4. Recorte: recorte tudo na aoi do caso e salve em data/nisar/ como GeoTIFF.
5. Enchente: converta para dB, aplique filtro de mediana 3×3, marque como alagado onde a queda passa de flood_db_drop e o valor depois fica abaixo de water_db_max, e remova a água que já existia antes.
6. Deslizamento: marque candidatos onde a queda de coerência passa de coherence_drop, a declividade passa de 15° e a coerência de referência passa de coherence_ref_min. Remova manchas menores que min_blob_pixels.
7. Saídas: data/cog/wa_2025_flood_nisar.tif, data/cog/wa_2025_water_nisar.tif, data/cog/wa_2025_landslide_candidates.tif e as versões em polígono em data/geojson/. Grave a área alagada em km² e o número de candidatos em data/metrics.json.
8. Pronto quando: a máscara de água permanente bate visualmente com os rios conhecidos, a área alagada é maior que zero e menor que a área total, e o README lista os IDs dos produtos NISAR usados.

## Modo 3. Validação, "acertamos?"

| Pergunta | Métrica | Dado |
| --- | --- | --- |
| O alerta veio antes? | Percentual das áreas confirmadas que estavam Alto ou Crítico 24 a 48h antes | TPI contra NISAR |
| A enchente do radar está certa? | IoU e F1 nos pixels sem nuvem | OPERA DSWx-HLS |
| O timing bate? | Pico do nível do rio na janela da enchente | SWOT (Hydrocron) |
| Os deslizamentos estão certos? | Percentual de pontos do catálogo em Alto ou Crítico | Global Landslide Catalog |
| Por que radar? | Percentual da área coberta por nuvem no óptico | Máscara Fmask do HLS |
| O proxy de HAND está certo? | Correlação e IoU da zona de HAND abaixo de 5 m | MERIT Hydro, banda hnd (só referência) |

#### Instruções para o agente dev, Modo 3 (python/04_validation.py, python/05_swot.py, gee/ script de HAND)

1. OPERA DSWx: busque com earthaccess (OPERA_L3_DSWX-HLS_V1, e também DSWx-S1 no caso wa_2025) na área e em até 5 dias depois do pico. Use a camada WTR.
2. Comparação de água: reprojete o OPERA para a grade do NISAR com vizinho mais próximo. Considere água os valores 1 e 2. Exclua 253 (nuvem) e 255 (sem dado). Calcule IoU e F1 entre water_nisar e OPERA.
3. Nuvem: calcule o percentual de pixels 253 no pico. Esse número vai para o pitch.
4. SWOT: consulte a API Hydrocron para o reach_id do rio principal de cada caso. Remova valores de preenchimento e salve a série.
5. Deslizamentos: cruze os pontos do Global Landslide Catalog da janela do caso com as classes do TPI do dia do evento. Calcule o percentual em Alto ou Crítico.
6. HAND: rode o script GEE 4 para os raios de 1.000, 1.500 e 3.000 m. Grave correlação e IoU de cada raio e atualize hand_proxy_radius_m com o melhor.
7. Saídas: data/metrics.json com as chaves iou, f1, cloud_pct, landslide_hit_pct, hand_validation por caso, e data/series/<caso>_swot.json.
8. Pronto quando: cada métrica tem valor numérico ou null com o motivo, e nenhuma métrica foi calculada com pixels de nuvem.

## Camada de impacto

- Pessoas expostas: soma do GPW v4 nas áreas críticas e confirmadas.
- Área alagada: km² da máscara NISAR.
- Apagão: queda de radiância noturna no Black Marble, depois contra a média de antes.

#### Instruções para o agente dev, impacto (gee/05_impact.js)

1. População: some CIESIN/GPWv411/GPW_Population_Count (ano mais próximo do evento) dentro das áreas Críticas do TPI do dia do evento e, no caso wa_2025, dentro da máscara de enchente NISAR.
2. Apagão: use NASA/VIIRS/002/VNP46A2. Compare a média de radiância de 7 noites depois do evento com a média de 30 noites antes, só em pixels de boa qualidade. Reporte a queda percentual na área afetada.
3. Saídas: chaves people_critical, people_flooded, flooded_km2 e night_light_drop_pct em data/metrics.json.
4. Pronto quando: a população em área crítica é menor que a população total da área, e o README explica o ano do GPW usado.

## Camada preditiva e ML

Com esta camada o projeto passa de "avisa e confirma" para prevê, avisa e confirma. Ela tem três níveis, do mais garantido ao mais ambicioso.

| Nível | O que faz | Dados | Esforço | Quando |
| --- | --- | --- | --- | --- |
| 1. Antecipação | Mede quantas horas antes do dano cada área virou Crítico | IMERG, SMAP, horário dos eventos | Baixo | MVP |
| 2. Projeção de 72h | Soma a chuva observada com a chuva prevista e calcula o TPI de D+1 a D+3 | IMERG e GEOS-FP (NASA GMAO) | Médio | Domingo de manhã, se a previsão histórica estiver acessível |
| 3. Modelo de ML | Random Forest no GEE que dá a probabilidade de deslizamento | Catálogo de deslizamentos, NASADEM, MODIS, IMERG, SMAP | Médio a alto | Sábado à noite, se o MVP estiver de pé |

### Nível 1. Antecipação

No replay do evento, para cada área confirmada, calcular a diferença entre a hora em que o TPI cruzou 0,6 e a hora do primeiro dano registrado.

Métrica do pitch: "o Tipping Point teria avisado X horas antes".

#### Instruções para o agente dev, nível 1

1. Use a série diária do TPI do Modo 1. Se o tempo permitir, rode a série a cada 3 h para ter antecipação em horas.
2. Para cada pixel, encontre a primeira data em que TPI_slide passa de 0,6.
3. Para cada deslizamento do catálogo na janela do caso, calcule a antecipação em horas: data do evento menos a primeira data crítica.
4. Saídas: lead_time_mean_h, lead_time_median_h e warned_before_pct em data/metrics.json.
5. Pronto quando: cada deslizamento tem antecipação positiva, negativa (avisou depois) ou null (nunca virou crítico), e as três contagens estão no README.

### Nível 2. Projeção com chuva prevista

- Fonte: previsão de precipitação do GEOS-FP (NASA GMAO), até 10 dias, em NetCDF pelo portal do GMAO. Não está no catálogo do GEE.
- Lógica: chuva acumulada = IMERG observado + GEOS-FP previsto. O SMAP fica constante na projeção, e isso é declarado como limitação.
- No app: a timeline continua depois de "hoje" com linha tracejada e rótulo "previsão".
- Risco: o replay precisa da previsão emitida antes do evento. Se o arquivo histórico não estiver disponível, usar a chuva observada como "previsão perfeita" e declarar.
- Decisão em aberto: o NOAA GFS tem arquivo histórico no GEE (NOAA/GFS0P25), mas quebra a regra de só usar dados NASA.

#### Instruções para o agente dev, nível 2

1. Primeiro, confirme se o arquivo histórico do GEOS-FP tem previsões emitidas até 3 dias antes de cada evento. Se não tiver, pare e reporte ao time antes de seguir.
2. Baixe a precipitação prevista, recorte na área e reamostre para a grade do IMERG.
3. Some a chuva observada até a data de emissão com a prevista para D+1, D+2 e D+3. Recalcule R com a mesma climatologia. Mantenha S constante.
4. Saídas: data/cog/<caso>_tpi_forecast_d1.tif, _d2.tif e _d3.tif, e a flag forecast_source em data/metrics.json (geos-fp ou perfect-forecast).
5. Pronto quando: o app consegue mostrar os três dias de previsão com rótulo, e o README diz qual fonte foi usada.

### Nível 3. Modelo de ML

3a. Suscetibilidade aprendida (T_ML). Substitui a nota de terreno escrita à mão.

1. Positivos: pontos do Global Landslide Catalog com localização precisa.
2. Negativos: pontos aleatórios a mais de 5 km de deslizamentos conhecidos, na proporção de 1:1 a 1:3.
3. Variáveis: declividade, orientação, altitude e curvatura (NASADEM), uso do solo (MODIS), chuva média anual (IMERG mensal) e umidade média do solo (SMAP).
4. Modelo: ee.Classifier.smileRandomForest em modo probabilidade.
5. Explicabilidade: classifier.explain() dá a importância de cada variável, que vira gráfico no pitch.
6. Validação: AUC com 30% dos pontos, separados por região e não ao acaso, para evitar resultado inflado por pontos vizinhos.

`TPI = R \times S \times T_{ML}`

3b. Gatilho aprendido (extra). Mesma ideia do LHASA versão 2 da NASA. Para cada deslizamento com data (desde 2015, início do SMAP), extrair a chuva antecedente e a umidade do solo daquele dia. O negativo é o mesmo ponto em datas sem evento. O modelo aprende a probabilidade de deslizar dado o terreno, a chuva e o solo do dia. Alimentado com a chuva projetada do Nível 2, vira probabilidade de deslizamento em 24, 48 e 72h.

Comparação que vai para o pitch: taxa de acerto do modelo de ML contra a regra manual, nos mesmos eventos.

#### Instruções para o agente dev, nível 3

1. Dados de treino: filtre o Global Landslide Catalog para Sul e Sudeste do Brasil, mantendo só pontos com precisão de localização de até 5 km. Suba como asset.
2. Negativos: gere pontos aleatórios a mais de 5 km de qualquer deslizamento, na proporção de 3 negativos por positivo, com seed = 42.
3. Variáveis: elevation, slope, aspect, curvature, landcover, rain_mean, soil_mean, todas na escala de 90 m.
4. Divisão: separe treino e teste por blocos espaciais de cerca de 50 km, não ao acaso.
5. Modelo: ee.Classifier.smileRandomForest(200) em modo PROBABILITY.
6. Avaliação: calcule a AUC no teste para o Random Forest e para a regra manual de declividade. Exporte a importância das variáveis.
7. 3b (só se sobrar tempo): para cada deslizamento com data desde 2015, extraia chuva de 3 e 7 dias e umidade do solo do dia. Negativos são o mesmo ponto em 5 datas aleatórias sem evento. Treine o mesmo modelo com essas variáveis dinâmicas mais as do terreno.
8. Saídas: data/cog/t_ml.tif, e rf_auc, rule_auc e feature_importance em data/metrics.json.
9. Pronto quando: a AUC foi calculada em blocos que o modelo não viu, e o gráfico de importância está salvo para o app.

### Onde não usar ML

- Máscara de enchente NISAR: o limiar de backscatter funciona e se explica em uma frase.
- Deep learning: não há dado rotulado nem tempo suficientes.

## Casos de validação: Washington (EUA) e Rio Grande do Sul

Os dois casos se completam. Washington prova a confirmação por radar, porque já tem dado NISAR. O Rio Grande do Sul prova a previsão onde o time vive, mas aconteceu antes do NISAR existir.

| | Washington, EUA | Rio Grande do Sul, Brasil |
| --- | --- | --- |
| Evento | Rios atmosféricos com enchentes e deslizamentos, a partir de 8 dez 2025 | Enchente histórica, abr e mai 2024 |
| O que prova | Confirmação NISAR e validação completa | Previsão (níveis 1 a 3) e impacto |
| Alerta (TPI) | IMERG, SMAP, NASADEM | IMERG, SMAP, NASADEM |
| Confirmação | NISAR GCOV e GUNW | Sem NISAR (lançado em jul 2025). MODIS NRT Flood e OPERA DSWx-HLS nos dias sem nuvem |
| Validação da enchente | OPERA DSWx-HLS e DSWx-S1 (cobre a América do Norte) | OPERA DSWx-HLS, MODIS NRT Flood |
| Nível do rio | SWOT (Hydrocron) | SWOT no Guaíba e no Jacuí, se houve passagem |
| Deslizamentos | Global Landslide Catalog | Global Landslide Catalog |
| Argumento no pitch | "O radar viu através da tempestade" | "O Tipping Point teria avisado X horas antes" |

### Caso 1. Washington, dezembro de 2025

- Evento: no início de dezembro de 2025, uma sequência de rios atmosféricos trouxe chuva histórica ao oeste de Washington, com mais de 250 mm em alguns pontos, enchentes catastróficas e deslizamentos (U.S. Army).
- Por que serve: a região tem densidade alta de dados de validação e o OPERA DSWx-S1 cobre a América do Norte.
- Disponibilidade NISAR: a liberação de fevereiro de 2026 trouxe produtos de um subconjunto das aquisições entre 17 out 2025 e 20 jan 2026 (ASF). São produtos pré-calibração (BETA). O reprocessamento validado do período deve sair até o fim de 2026.
- Primeiro passo: abrir o ASF Vertex, filtrar NISAR, oeste de Washington, 1 nov 2025 a 31 jan 2026, e achar um par antes e depois do pico.

### Caso 2. Rio Grande do Sul, maio de 2024

- Por que serve: é a maior tragédia climática do estado e é onde o time vive. Ver a seção O problema.
- O que valida: a antecipação do alerta (nível 1), o modelo de ML (nível 3) e o impacto (GPW e Black Marble).
- O argumento do radar: medir com o HLS quanto da área ficou coberta por nuvem durante o pico. Isso mostra o que o óptico não viu e o que o NISAR resolve dali em diante.
- Limitação declarada: sem confirmação por radar neste caso.

### Se houver NISAR sobre o Brasil

Dados NISAR calibrados são públicos desde 20 jul 2026, para aquisições a partir de 17 jun 2026 (ASF). Se houver um evento de chuva forte no Sul depois dessa data, ele vira um terceiro caso e fecha a história com radar no Brasil.

## Dados NASA e onde encontrar

Todo o projeto usa só dados NASA. Sete conjuntos estão no catálogo do Google Earth Engine; os demais vêm por Python e sobem como asset.

### No Google Earth Engine

| Dado | Missão | Uso | ID no GEE |
| --- | --- | --- | --- |
| IMERG V07 | GPM | Chuva acumulada e climatologia desde 2000 | NASA/GPM_L3/IMERG_V07 |
| SMAP L4 | SMAP | Umidade do solo antecedente | NASA/SMAP/SPL4SMGP (versão mais recente) |
| NASADEM | SRTM reprocessado | Declividade e proxy de HAND | NASA/NASADEM_HGT/001 |
| MODIS Land Cover | Terra e Aqua | Uso do solo no índice de terreno | MODIS/061/MCD12Q1 |
| HLS | Landsat e Sentinel-2 harmonizados | Fração de nuvem e cicatriz óptica | NASA/HLS/HLSL30/v002, NASA/HLS/HLSS30/v002 |
| GPW v4 | NASA SEDAC | População exposta | CIESIN/GPWv411/GPW_Population_Count |
| Black Marble | VIIRS | Apagão pós-evento | NASA/VIIRS/002/VNP46A2 |

Referência de validação, não é entrada: MERIT Hydro (MERIT/Hydro/v1_0_1, banda hnd), HAND pronto a cerca de 90 m, derivado do SRTM. Serve só para validar e calibrar o proxy de HAND. Todas as entradas do índice continuam sendo NASA.

### Fora do GEE (Python ou download)

| Dado | Missão | Uso | Onde | Ferramenta |
| --- | --- | --- | --- | --- |
| NISAR GCOV e GUNW | NISAR | Confirmação de enchente e deslizamento | ASF DAAC (Vertex) | asf_search ou earthaccess |
| OPERA DSWx-HLS | OPERA (JPL) | Validação da enchente, 30 m | PO.DAAC | earthaccess |
| SWOT River | SWOT | Nível do rio no tempo | API Hydrocron (PO.DAAC) | requests |
| MODIS/VIIRS NRT Flood | LANCE | Visão diária regional da enchente | NASA LANCE e Worldview | download direto |
| Suscetibilidade LHASA | NASA GSFC | Atalho para o índice de terreno | NASA GSFC | GeoTIFF, sobe como asset |
| Global Landslide Catalog | NASA GSFC | Validação dos deslizamentos | data.nasa.gov | CSV, sobe como tabela |
| GEOS-FP, previsão de chuva | NASA GMAO | Projeção do TPI para 72h (nível 2) | Portal do GMAO, NetCDF | xarray |

### Cuidados

- Conta NASA Earthdata Login (urs.earthdata.nasa.gov) é obrigatória para NISAR, OPERA e LHASA.
- Janela do NISAR. Lançado em julho de 2025. Eventos anteriores não têm dado. Confirmar cobertura no ASF Vertex antes de escolher o evento.
- OPERA DSWx-S1 cobre só a América do Norte. Para o Brasil, usar DSWx-HLS.
- SWOT passa a cada 21 dias. Confirmar passagem sobre o rio do evento.
- Catálogo do GEE muda. Buscar "NISAR" e "OPERA" no catálogo antes de assumir que não estão lá.

```sh
pip install earthaccess asf_search rasterio rioxarray
```

## Infraestrutura e arquitetura

A arquitetura é híbrida e sem backend. O GEE faz o processamento pesado, o Python traz o que não está no GEE, e o app só lê arquivos pré-computados.

arquitetura · 3 fontes, 2 motores, 1 app estático

O que não existe no GEE é baixado por Python, recortado na área do evento e sobe como asset. Assim a análise final roda num lugar só.

### Stack

| Camada | Tecnologia |
| --- | --- |
| Processamento raster | Google Earth Engine (JavaScript Code Editor ou API Python) |
| Download e radar | Python, earthaccess, asf_search, rasterio, rioxarray, numpy |
| Formatos de saída | COG para rasters, GeoJSON para polígonos, JSON para métricas |
| Front | React, Vite, MapLibre GL, georaster para COG, Recharts para gráficos |
| Hospedagem | Vercel para o app, bucket Google Cloud Storage para os dados, GitHub Actions para o modo Agora |
| Contas | NASA Earthdata Login, Google Earth Engine, GitHub |

### Fluxo de dados

1. Scripts GEE geram TPI, impacto e fração de nuvem e exportam COG.
2. Notebooks Python baixam NISAR e OPERA, geram máscaras e métricas, e sobem LHASA e catálogo como asset.
3. A consulta ao SWOT gera a série do rio em JSON.
4. Tudo vai para /data no repositório.
5. O app lê /data e é publicado como site estático.

### Estrutura do repositório

```text
tipping-point/
├── gee/                    01_rain.js 02_soil.js 03_terrain.js 04_tpi.js 05_impact.js
├── python/                 01_get_nisar.py 02_flood_mask.py 03_landslide_coh.py
│                           04_validation.py    05_swot.py
├── data/                   cog/ geojson/ metrics.json
├── app/                    React + Vite + MapLibre
└── README.md método, limiares, dados NASA, limitações
```

### Armazenamento e disponibilização

No hackathon não há backend. Todo o processamento roda antes, os resultados ficam num bucket como arquivos estáticos, e o app só lê esses arquivos.

- Processamento. GEE pela API Python (earthengine-api), não pelo Code Editor, para rodar de novo com um comando. Python local ou no Colab para NISAR, OPERA e SWOT. Um comando roda tudo: make all CASE=rs_2024.
- Pré-requisito do GEE. Projeto Google Cloud registrado para uso não comercial do Earth Engine, com ee.Initialize(project='tipping-point-xxx'), e uma service account para os jobs automáticos.
- Armazenamento. Um bucket no Google Cloud Storage, porque o GEE exporta direto com Export.image.toCloudStorage. Os arquivos do Python sobem com gsutil cp. Leitura pública e CORS liberado. A pasta local data/ é só área de trabalho antes do upload.
- Exibição no mapa. Cada camada e cada dia vira um PNG já pintado com a paleta, mais as coordenadas de canto. O MapLibre mostra como image source e a timeline só troca a imagem. É o caminho mais robusto para 48h.
- COGs ficam para download e reprodutibilidade. Se der tempo, o geotiff.js lê o valor do pixel no clique.
- Números em JSON: métricas, séries de chuva, solo e SWOT, áreas críticas.
- manifest.json é o contrato entre dados e front. Lista cada camada com caso, data, URL, limites, legenda e updated_at. O app só conhece o manifest, então o time de dados regenera tudo sem mexer no front, e o front começa com dados falsos no mesmo formato.

```text
gs://tipping-point-data/
├── rs_2024/
│   ├── cog/                       tpi_slide_series.tif, t_ml.tif ...
│       ├── png/                   tpi_slide_20240425.png ... (uma por dia)
│       └── geojson/               areas_criticas.geojson
├── wa_2025/
│   ├── cog/                       flood_nisar.tif, landslide_candidates.tif ...
│       ├── png/                   nisar_pre.png, nisar_post.png, tpi_*.png
│   └── geojson/                   flood_nisar.geojson
├── now/                           camadas do modo Agora (sobrescritas a cada execução)
├── static/                        climatologia e terreno do Sul, calculados uma vez
├── metrics.json
└── manifest.json
```

```json
{
    "updated_at": "2026-11-15T09:00:00Z",
    "cases": {
        "rs_2024": {
            "mode": "replay",
            "bounds": [-52.5, -30.5, -50.5, -29.0],
            "layers": [
                {"id": "tpi_slide", "date": "2024-05-02",
                    "png": "rs_2024/png/tpi_slide_20240502.png",
                    "cog": "rs_2024/cog/tpi_slide_series.tif",
                    "legend": ["Baixo", "Moderado", "Alto", "Crítico"]}
            ],
            "metrics": "metrics.json#rs_2024"
        },
        "now": {
            "mode": "live",
            "bounds": [-58.0, -34.0, -48.0, -22.5],
            "data_dates": {"imerg": "2026-11-15T05:00Z", "smap": "2026-11-12", "geos_fp_issued": "2026-11-15T00:00Z"},
            "layers": []
        }
    }
}
```

## Modo Agora: dados atualizados

O app tem dois modos. Replay mostra os casos validados de RS e Washington e prova que funciona. Agora mostra o Sul do Brasil atualizado a cada 3 horas e prova que está vivo.

O julgamento acontece semanas depois do hackathon, com finalistas em dezembro e vencedores em janeiro. Quando o juiz abrir o link, ver "atualizado há 2 horas" mostra que a solução é real. Novembro a janeiro é estação de chuva no Sul, então há chance de o juiz ver um alerta de verdade.

| Camada | Fonte | Atraso aproximado | No modo Agora |
| --- | --- | --- | --- |
| Chuva observada | IMERG Early Run (GPM_3IMERGHHE, GES DISC) | ~4 h | Atualiza a cada execução |
| Chuva prevista D+1 a D+3 | GEOS-FP (NASA GMAO), emitido todo dia | Horas | Atualiza a cada execução |
| Umidade do solo | SMAP L4 (SPL4SMGP, NSIDC) | ~2 a 3 dias | Atualiza, com rótulo "dados de dd/mm" |
| Terreno, ML e climatologia | Pré-calculados em static/ | Estáticos | Não muda |
| Passagens do NISAR | Metadados via asf_search | Dias | Lista "últimas passagens sobre a área" |
| Confirmação de dano | NISAR | Dias | Só se houver evento |

No modo Agora a previsão fica mais fácil que no replay. A previsão GEOS-FP de hoje está sempre disponível, enquanto o arquivo histórico era o risco do nível 2.

Teste antes de decidir a fonte da chuva. O IMERG do catálogo do GEE pode ser só a versão Final, com meses de atraso. Se a data abaixo for antiga, a chuva ao vivo vem do GES DISC pelo earthaccess.

```js
print(ee.ImageCollection('NASA/GPM_L3/IMERG_V07')
    .sort('system:time_start', false).first().date());
```

### Pipeline

```text
GitHub Actions (cron a cada 3 h, grátis)
      │
      ├─ baixa IMERG Early (últimos 7 dias) + SMAP L4 mais recente + GEOS-FP de hoje
      ├─ calcula R, S e TPI com a climatologia e o terreno de static/
      ├─ calcula a projeção D+1, D+2 e D+3
      ├─ lista as últimas passagens NISAR sobre o Sul
      ├─ gera PNG + JSON + áreas críticas em now/
      └─ atualiza manifest.json com updated_at e data de cada dado
                                     │
                        App lê o manifest → "Atualizado há 2 h"
```

- GitHub Actions é grátis, roda sozinho por meses sem servidor, e o histórico de execuções fica visível no repositório.
- Área: Sul do Brasil inteiro (RS, SC e PR) em cerca de 1 km, para o job rodar em minutos.

### Proteções para a demo

- O app sempre mostra a data de cada camada. Nada parece mais atual do que é.
- Se o job falhar, o app mostra o último resultado bom com um aviso discreto. O Replay continua funcionando.
- Se não chover, o mapa fica quase todo Baixo, e isso é honesto. A projeção de 72h e a lista de passagens NISAR mostram que o sistema está vivo.
- Credenciais (Earthdata e service account do GEE) ficam nos secrets do GitHub.

Esforço e prioridade: de 4 a 6 horas para uma pessoa, reaproveitando o Modo 1. Entra depois do MVP, no sábado à noite ou no domingo de manhã. O Replay tem prioridade.

#### Instruções para o agente dev, modo Agora (live/run_now.py, .github/workflows/now.yml)

1. Uma vez: calcule e salve em static/ a climatologia de chuva (percentis 90, 95 e 99 de 3 dias, por mês) e as notas de terreno T do Sul do Brasil em cerca de 1 km.
2. A cada execução: baixe o IMERG Early dos últimos 7 dias, o SMAP L4 mais recente e a previsão GEOS-FP emitida mais recente. Use earthaccess para IMERG e SMAP.
3. Calcule R, S, TPI de hoje e a projeção D+1 a D+3 com a mesma lógica e os mesmos limiares do config.yaml.
4. Liste as passagens NISAR dos últimos 14 dias sobre a área com asf_search, só metadados.
5. Gere PNGs, GeoJSON das áreas críticas e now/summary.json com km² críticos, pessoas expostas e data de cada fonte.
6. Suba em gs://tipping-point-data/now/ e atualize manifest.json por último, para o app nunca ler um conjunto pela metade.
7. Workflow: on: schedule com cron: '0 */3 * * *' mais workflow_dispatch para rodar à mão. Secrets EDL_USER, EDL_PASS e GCP_SA_KEY.
8. Pronto quando: duas execuções seguidas terminam sem erro, o updated_at muda, e o app mostra a data certa de cada camada.

## GEE ao vivo (extra)

Para mostrar qualquer data e lugar, e não só os casos prontos, dá para criar uma função serverless na Vercel.

- A função (Python ou Node) guarda a service account do GEE em variável de ambiente.
- O app chama /api/tiles?layer=tpi&date=2024-05-02. A função monta a imagem no GEE, chama getMapId() e devolve a URL de tiles XYZ, que o MapLibre consome direto.
- As URLs de tiles do GEE expiram em algumas horas, e a climatologia é pesada. Usem a climatologia salva como asset.
- É extra. Se cair, a demo continua com os arquivos estáticos.

## Roadmap do backend de produção

Vai no slide de próximos passos. Não se constrói neste fim de semana.

| Camada | Tecnologia |
| --- | --- |
| Agendamento | Job a cada nova janela do IMERG Early e a cada passagem do NISAR sobre área em alerta (Cloud Run Jobs ou AWS Batch) |
| Catálogo de camadas | STAC, com cada camada e data como item consultável |
| Tiles dinâmicos | TiTiler servindo os COGs direto do bucket |
| Alertas e áreas | PostGIS, com polígonos críticos, histórico e municípios |
| API | Django REST Framework: alertas por município, séries e métricas |
| Notificação | Webhook, e-mail ou WhatsApp para a Defesa Civil |

## Plus opcional: alertas para a população via Telegram

Este módulo é opcional. Só entra depois do MVP do Replay. Se não der tempo, vai para o roadmap sem prejuízo para o projeto. Esforço estimado: de 3 a 4 horas para uma pessoa.

O morador compartilha a localização com um bot no Telegram e recebe um aviso quando o risco da sua região sobe. Fecha a história do satélite até a pessoa, e é o momento mais forte do vídeo.

Por que Telegram: o bot sai em minutos pelo BotFather, é grátis e não passa por aprovação. A API do WhatsApp Business exige verificação da empresa e templates aprovados.

### Três cuidados obrigatórios

1. Complementar à Defesa Civil, nunca no lugar dela. Toda mensagem termina com "Siga as orientações da Defesa Civil. SMS 40199."
2. Precisão de bairro ou região, não de rua. A chuva tem cerca de 10 km de resolução e o índice cerca de 1 km. O texto diz "sua região", nunca "sua casa".
3. LGPD. Nada de endereço digitado. O morador usa o botão de localização do Telegram. Guardamos só o chat_id e as coordenadas arredondadas para 2 casas decimais (cerca de 1 km), com consentimento na primeira mensagem. O comando /parar apaga tudo.

### Fluxo

```text
Morador → /start → lê os termos → toca em "Compartilhar minha localização"
                                          │
                Função na Vercel (webhook do Telegram)
                                          │
                Salva chat_id + lat/lon arredondadas no Firestore
                                          │
GitHub Actions (modo Agora, a cada 3 h) ──► lê o TPI de hoje e de D+1 em cada ponto
                                          │
                Classe subiu para Alto ou Crítico? ──► envia o alerta pelo bot
```

### Comandos

| Comando | O que faz | Depende de |
| --- | --- | --- |
| /start | Mostra os termos e pede a localização | Webhook |
| /status | Risco atual da região e data dos dados | Modo Agora |
| /simular | Envia em sequência os alertas que teriam chegado em Encantado (RS) em maio de 2024 | Só dados do Replay |
| /parar | Apaga o cadastro | Webhook |

O /simular funciona mesmo sem o modo Agora e o juiz pode testar sozinho, semanas depois. Se só der tempo de uma coisa, façam o /start e o /simular.

### Mensagem de alerta

```text
⚠️ Tipping Point: risco CRÍTICO de deslizamento
Região: Encantado, RS
Chuva de 3 dias acima de 99% do histórico. Solo saturado.
Previsão: risco segue crítico nas próximas 24 h.
Dados NASA: IMERG até 01/05 14:00 · SMAP de 29/04
Ver no mapa: https://SEU-APP.vercel.app
Siga as orientações da Defesa Civil. SMS 40199.
```

### Regras de envio

- Envia só quando a classe sobe para Alto ou Crítico, considerando hoje e D+1.
- No máximo um alerta a cada 6 horas por pessoa.
- Envia "risco reduzido" quando a classe cai.
- Nunca envia entre 23h e 6h, a menos que a classe seja Crítico.

#### Instruções para o agente dev, Telegram

1. Bot: crie no BotFather (/newbot). Guarde o token como TELEGRAM_TOKEN nos secrets do GitHub e nas variáveis de ambiente da Vercel. Gere uma senha aleatória como TELEGRAM_SECRET.
2. Banco: ative o Firestore no mesmo projeto Google Cloud do GEE (modo nativo, plano gratuito). Coleção subscribers, um documento por chat_id, com lat, lon, consent, last_class, last_alert_ts, current_label e data_date.
3. Webhook: publique api/telegram.py na Vercel e registre o webhook com o secret_token (comando abaixo).
4. Simulação: rode o script GEE 5, converta com tools/build_simular.py e suba simular.json no bucket.
5. Alertas reais: adicione live/alerts.py como último passo do workflow do modo Agora.
6. Pronto quando: um celular do time faz /start, compartilha a localização, recebe a resposta, roda /simular e recebe a sequência, e /parar apaga o documento no Firestore.

### Código GEE 5. Pré-cálculo do /simular

No script GEE 1, exporte também a série como asset: troque Export.image.toDrive por Export.image.toAsset com assetId: 'users/SEU_USUARIO/rs_2024_tpi_slide_series'. As bandas ficam com nomes 0_TPI_slide, 1_TPI_slide e assim por diante. A banda 0 é o primeiro dia da janela (10 dias antes do evento).

```js
// Pré-calcula os alertas do /simular para o caso RS 2024
var series = ee.Image('users/SEU_USUARIO/rs_2024_tpi_slide_series');

// Cidades da demo. Confiram as coordenadas antes de rodar.
var towns = ee.FeatureCollection([
  ee.Feature(ee.Geometry.Point([-51.87, -29.24]), {name: 'Encantado'}),
  ee.Feature(ee.Geometry.Point([-51.87, -29.16]), {name: 'Muçum'}),
  ee.Feature(ee.Geometry.Point([-51.87, -29.28]), {name: 'Roca Sales'}),
  ee.Feature(ee.Geometry.Point([-51.96, -29.47]), {name: 'Lajeado'}),
  ee.Feature(ee.Geometry.Point([-51.18, -29.92]), {name: 'Canoas'}),
  ee.Feature(ee.Geometry.Point([-51.23, -30.03]), {name: 'Porto Alegre'})
]);

// Maior TPI num raio de 2 km de cada cidade, para cada dia (uma propriedade por banda)
var table = series.reduceRegions({
  collection: towns.map(function (f) { return f.buffer(2000); }),
  reducer: ee.Reducer.max(),
  scale: 1000
});

print('Confira os valores antes de exportar', table);
Export.table.toDrive({collection: table, description: 'simular_rs_2024',
fileFormat: 'CSV'});
```

### Código Python. Converte para simular.json

```python
# tools/build_simular.py
import json
import datetime as dt
import pandas as pd

START = dt.date(2024, 5, 2) - dt.timedelta(days=10)                 # primeiro dia da janela
LABELS = ['Baixo', 'Moderado', 'Alto', 'Crítico']

def tpi_class(v):
    return 0 if v < 0.2 else 1 if v < 0.4 else 2 if v < 0.6 else 3

df = pd.read_csv('simular_rs_2024.csv')
band_cols = sorted([c for c in df.columns if c.endswith('_TPI_slide')],
                   key=lambda c: int(c.split('_')[0]))
out = {}
for _, row in df.iterrows():
    steps, last = [], None
    for col in band_cols:
        day = START + dt.timedelta(days=int(col.split('_')[0]))
        c = tpi_class(row[col])
        if c != last:  # só guarda mudanças de classe, como o bot de verdade faria
            steps.append({'date': day.strftime('%d/%m/%Y'), 'label': LABELS[c]})
        last = c
    out[row['name']] = steps
json.dump(out, open('simular.json', 'w'), ensure_ascii=False, indent=2)
```

### Código Python. Webhook do bot na Vercel

```python
# api/telegram.py                  (requirements.txt: requests, google-cloud-firestore)
import json
import os
import requests
from http.server import BaseHTTPRequestHandler
from google.cloud import firestore
from google.oauth2 import service_account

TOKEN = os.environ['TELEGRAM_TOKEN']
SECRET = os.environ['TELEGRAM_SECRET']
creds = service_account.Credentials.from_service_account_info(json.loads(os.environ['GCP_SA_KEY']))
db = firestore.Client(credentials=creds, project=creds.project_id)

API = f'https://api.telegram.org/bot{TOKEN}'
APP_URL = 'https://SEU-APP.vercel.app'
SIMULATION_URL = 'https://storage.googleapis.com/tipping-point-data/rs_2024/simular.json'
FOOTER = 'Siga as orientações da Defesa Civil. SMS 40199.'

TERMS = ('Olá! O Tipping Point usa dados da NASA para estimar o risco de deslizamento e enchente na sua região. '
         'Para receber avisos, compartilhe sua localização no botão abaixo. Guardamos só uma posição aproximada '
         '(cerca de 1 km) e você apaga tudo com /parar. Os avisos são informativos. ' + FOOTER)

def send(chat_id, text, keyboard=None):
    body = {'chat_id': chat_id, 'text': text}
    if keyboard:
        body['reply_markup'] = keyboard
    requests.post(f'{API}/sendMessage', json=body, timeout=10)

def handle(update):
    msg = update.get('message') or {}
    chat_id = msg.get('chat', {}).get('id')
    if not chat_id:
        return
    text = msg.get('text', '')
    ref = db.collection('subscribers').document(str(chat_id))

    if 'location' in msg:
        loc = msg['location']
        ref.set({'lat': round(loc['latitude'], 2), 'lon': round(loc['longitude'], 2),
                 'consent': True, 'last_class': 0, 'last_alert_ts': 0})
        send(chat_id, 'Cadastro feito. Você vai receber um aviso quando o risco da sua região subir. '
                      'Use /status para ver o risco agora.')
    elif text.startswith('/start'):
        kb = {'keyboard': [[{'text': 'Compartilhar minha localização', 'request_location': True}]],
              'one_time_keyboard': True, 'resize_keyboard': True}
        send(chat_id, TERMS, kb)
    elif text.startswith('/status'):
        snap = ref.get()
        if not snap.exists:
            send(chat_id, 'Você ainda não cadastrou uma localização. Use /start.')
            return
        s = snap.to_dict()
        send(chat_id, f"Risco agora na sua região: {s.get('current_label', 'sem dados')}. "
                      f"Dados de {s.get('data_date', '-')}. Mapa: {APP_URL}\n{FOOTER}")
    elif text.startswith('/simular'):
        sim = requests.get(SIMULATION_URL, timeout=10).json()
        send(chat_id, 'Simulação: os avisos que o Tipping Point teria enviado para Encantado (RS) em 2024.')
        for step in sim['Encantado']:
            send(chat_id, f"{step['date']}: risco {step['label']}")
        send(chat_id, f'Veja o replay completo no mapa: {APP_URL}')
    elif text.startswith('/parar'):
        ref.delete()
        send(chat_id, 'Seus dados foram apagados. Volte quando quiser com /start.')

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.headers.get('X-Telegram-Bot-Api-Secret-Token') != SECRET:
            self.send_response(403)
            self.end_headers()
            return
        length = int(self.headers.get('Content-Length', 0))
        handle(json.loads(self.rfile.read(length)))
        self.send_response(200)
        self.end_headers()
```

Registrar o webhook, uma vez, no terminal:

```sh
curl "https://api.telegram.org/bot$TELEGRAM_TOKEN/setWebhook?url=https://SEU-APP.vercel.app/api/telegram&secret_token=$TELEGRAM_SECRET"
```

### Código Python. Alertas reais no modo Agora

```python
# live/alerts.py                   roda no GitHub Actions logo depois do run_now.py
import os
import time
import datetime as dt
import requests
import rasterio
from google.cloud import firestore

TOKEN = os.environ['TELEGRAM_TOKEN']
LABELS = ['Baixo', 'Moderado', 'Alto', 'Crítico']
FOOTER = 'Siga as orientações da Defesa Civil. SMS 40199.'

db = firestore.Client()  # usa a service account do GOOGLE_APPLICATION_CREDENTIALS

def tpi_class(v):
    return 0 if v < 0.2 else 1 if v < 0.4 else 2 if v < 0.6 else 3

def send(chat_id, text):
    requests.post(f'https://api.telegram.org/bot{TOKEN}/sendMessage',
                  json={'chat_id': chat_id, 'text': text}, timeout=10)

data_date = os.environ.get('DATA_DATE', '-')         # data do IMERG mais recente, vinda do run_now.py
hour = (dt.datetime.utcnow() - dt.timedelta(hours=3)).hour         # horário de Brasília
night = hour >= 23 or hour < 6

# COGs do modo Agora em EPSG:4326, com o TPI de deslizamento de hoje e de amanhã
with rasterio.open('data/now/tpi_slide_today.tif') as today, \
     rasterio.open('data/now/tpi_slide_d1.tif') as d1:
    for doc in db.collection('subscribers').stream():
        s = doc.to_dict()
        pt = [(s['lon'], s['lat'])]
        c = max(tpi_class(next(today.sample(pt))[0]),
                tpi_class(next(d1.sample(pt))[0]))
        last = s.get('last_class', 0)
        recent = time.time() - s.get('last_alert_ts', 0) < 6 * 3600
        update = {'current_label': LABELS[c], 'data_date': data_date}

        if c >= 2 and c > last and not recent and (not night or c == 3):
            send(doc.id, f'⚠️ Tipping Point: risco {LABELS[c].upper()} de deslizamento na sua região '
                         f'(hoje ou nas próximas 24 h). Dados NASA de {data_date}.\n{FOOTER}')
            update.update({'last_class': c, 'last_alert_ts': time.time()})
        elif c < last:
            send(doc.id, f'Tipping Point: o risco na sua região caiu para {LABELS[c]}.')
        update['last_class'] = c
        doc.reference.update(update)
```

## Exemplos de código

São rascunhos de partida para cada pessoa começar rodando. Antes de confiar nos resultados, confirmem as versões das coleções no catálogo do GEE e os caminhos internos dos produtos NISAR no NISAR Data User Guide.

### Guia de GEE para o time

Para quem nunca usou o Google Earth Engine. Leia antes de rodar os scripts GEE abaixo.

#### 1. Configuração (uma vez por pessoa)

1. Entre em code.earthengine.google.com com uma conta Google.
2. Se pedir, registre um projeto Google Cloud para uso não comercial (pesquisa ou educação). Usem um projeto só para o time, por exemplo tipping-point-xxx, e adicionem todos como membros.
3. No canto superior direito do Code Editor, selecione esse projeto.
4. Para rodar pela API Python (modo Agora e automações):

```sh
pip install earthengine-api
earthengine authenticate
```

```python
import ee
ee.Initialize(project='tipping-point-xxx')
print(ee.Image('NASA/NASADEM_HGT/001').bandNames().getInfo())          # teste: deve imprimir ['elevation', ...]
```

#### 2. A ideia central do GEE

O código não processa nada no seu computador. Ele descreve um cálculo, e o Google executa nos servidores dele quando você pede um resultado com print, Map.addLayer ou Export. Por isso:

- Não use for do JavaScript sobre coleções do GEE. Use .map(function (img) { ... }).
- Números do GEE são ee.Number, não números comuns. Use .add(), .multiply() e assim por diante.
- Se um print demorar ou der erro de tempo, o cálculo é pesado demais para a tela. Use Export.

#### 3. Os conceitos que bastam para este projeto

| Conceito | O que é | Exemplo no projeto |
| --- | --- | --- |
| ee.Image | Uma imagem com uma ou mais bandas | ee.Image('NASA/NASADEM_HGT/001') |
| ee.ImageCollection | Uma pilha de imagens no tempo | ee.ImageCollection('NASA/GPM_L3/IMERG_V07') |
| .filterDate(a, b) | Fica só com as imagens entre duas datas | Chuva dos últimos 3 dias |
| .select('banda') | Escolhe uma banda | .select('precipitation') |
| .sum(), .mean() | Junta a coleção numa imagem | Chuva acumulada, umidade média |
| .reduce(ee.Reducer.percentile([95])) | Estatística pixel a pixel | Percentil 95 da climatologia |
| .map(função) | Aplica uma função em cada item | TPI de cada dia da série |
| .reduceRegion(s) | Resume valores dentro de uma área ou de pontos | Valor do TPI em cada cidade |
| Export.image e Export.table | Salva o resultado (Drive, Cloud Storage ou asset) | COGs para o app |

#### 4. Como rodar um script

1. No Code Editor, clique em New e depois em File. Cole o script.
2. Troque SEU_USUARIO e os caminhos de asset pelo caminho do projeto do time (veja o item 5).
3. Clique em Run. Os print aparecem na aba Console à direita e as camadas no mapa.
4. Use a aba Inspector e clique no mapa para ver o valor de cada pixel.
5. Exports não rodam sozinhos. Abra a aba Tasks e clique em Run em cada tarefa. Arquivos grandes podem levar de minutos a uma hora.
6. Salve o script na pasta compartilhada do time (Scripts, depois New, depois Repository) e também no repositório Git.

#### 5. Como subir o catálogo de deslizamentos como asset

1. Baixe o Global Landslide Catalog em CSV no data.nasa.gov. Filtre o Brasil numa planilha e mantenha as colunas de latitude, longitude, data e precisão da localização.
2. Na aba Assets, clique em New e escolha CSV file (.csv).
3. Nas opções avançadas, indique as colunas de longitude e latitude.
4. Dê o nome glc_brasil e espere a tarefa terminar na aba Tasks.
5. O caminho fica parecido com projects/tipping-point-xxx/assets/glc_brasil. Use esse caminho no lugar de users/SEU_USUARIO/glc_brasil nos scripts.

#### 6. Ordem de execução dos scripts GEE

1. GEE 1 (TPI e série). Antes, salve a climatologia como asset para não recalcular toda vez (código abaixo).
2. GEE 4 (validação do HAND), para escolher o raio.
3. GEE 3 (Random Forest), se o nível 3 entrar.
4. GEE 2 (antecipação), que usa a série do GEE 1.
5. GEE 5 (simulação do Telegram), só se o plus entrar.

```js
// Rode uma vez, depois do trecho da climatologia do GEE 1
Export.image.toAsset({
  image: pct.clip(aoi), description: 'climatologia_rs_2024',
  assetId: 'projects/tipping-point-xxx/assets/climatologia_rs_2024',
  region: aoi, scale: 11132, maxPixels: 1e10
});
// Nas próximas execuções, troque o cálculo por:
// var pct = ee.Image('projects/tipping-point-xxx/assets/climatologia_rs_2024');
```

#### 7. Erros comuns e como resolver

| Erro | O que significa | Como resolver |
| --- | --- | --- |
| Computation timed out | O cálculo passou de cerca de 5 minutos na tela | Use Export em vez de print ou Map.addLayer. Teste antes com área e período menores |
| User memory limit exceeded | Dados demais de uma vez | Aumente o scale (por exemplo de 30 para 90 m) ou use tileScale: 4 em reduceRegion e sampleRegions |
| Too many pixels in the region | A região tem pixels demais para a escala pedida | Adicione maxPixels: 1e10 ou aumente o scale |
| Pattern did not match any bands | Nome de banda errado | Rode print(imagem.bandNames()) e copie o nome exato |
| Empty collection ou first of null | Nenhuma imagem no filtro | Rode print(colecao.size()) e confira as datas e a área |
| Asset not found | Caminho errado ou sem permissão | Confira o caminho na aba Assets e se o asset está no projeto do time |
| Camada demora ou aparece cinza | O GEE ainda está calculando na escala do zoom | Aproxime o zoom ou espere. Não é erro |

#### 8. Dicas que economizam horas

- Comece sempre com uma área pequena e poucos dias. Só depois aumente.
- Antes de qualquer conta, faça print(colecao.size()) e print(imagem.bandNames()).
- O IMERG tem resolução de cerca de 11 km e o SMAP de cerca de 9 km. Exportar essas camadas em 30 m só gasta tempo. Use 1.000 m para o TPI e 90 m para o terreno.
- Para passar um script do Code Editor para Python, troque function (x) { return ... } por lambda x: ..., print(x) por print(x.getInfo()) e Export.image.toDrive({...}) por ee.batch.Export.image.toDrive(...).start().

### GEE 1. Tipping Point Index e série para a timeline (Pessoa 1)

```js
// ===== Tipping Point Index, Modo 1 =====
// Caso RS: Vale do Taquari e região metropolitana de Porto Alegre
var aoi = ee.Geometry.Rectangle([-52.5, -30.5, -50.5, -29.0]);
var ref = ee.Date('2024-05-02'); // data de referência do evento

var imerg = ee.ImageCollection('NASA/GPM_L3/IMERG_V07').select('precipitation');
var dem = ee.Image('NASA/NASADEM_HGT/001').select('elevation');
var slope = ee.Terrain.slope(dem);

// Chuva acumulada em N dias (IMERG é mm/h a cada 30 min)
function accum(end, days) {
  return imerg.filterDate(end.advance(-days, 'day'), end).sum().multiply(0.5);
}

// Climatologia: janelas de 3 dias na mesma época do ano, 2001 a 2023
// Pesado: rode uma vez e exporte como asset
var years = ee.List.sequence(2001, 2023);
var offsets = ee.List.sequence(-30, 30, 3);
var clim = ee.ImageCollection.fromImages(years.map(function (y) {
  return offsets.map(function (o) {
    var end = ee.Date.fromYMD(y, ref.get('month'), ref.get('day')).advance(o, 'day');
    return accum(end, 3);
  });
}).flatten());
var pct = clim.reduce(ee.Reducer.percentile([90, 95, 99]));
var p90 = pct.select('precipitation_p90');
var p95 = pct.select('precipitation_p95');
var p99 = pct.select('precipitation_p99');

// Terreno
var T_slide = slope.unitScale(15, 30).clamp(0, 1);            // 0 abaixo de 15 graus, 1 acima de 30
var hand = dem.subtract(dem.focalMin({radius: 1500, units: 'meters'})); // proxy de HAND
var T_flood = ee.Image(1).subtract(hand.unitScale(5, 15)).clamp(0, 1)
  .where(slope.gt(5), 0);

function tpiAt(t) {
  t = ee.Date(t);
  var rain3 = accum(t, 3);
  var R = ee.Image(0)
    .where(rain3.gte(p90), rain3.subtract(p90).divide(p95.subtract(p90)).multiply(0.5))
    .where(rain3.gte(p95), rain3.subtract(p95).divide(p99.subtract(p95)).multiply(0.5).add(0.5))
    .where(rain3.gte(p99), 1).clamp(0, 1);
  var S = ee.ImageCollection('NASA/SMAP/SPL4SMGP/007').select('sm_rootzone_wetness')
    .filterDate(t.advance(-1, 'day'), t).mean().unitScale(0.5, 0.9).clamp(0, 1);
  return R.multiply(S).multiply(T_slide).rename('TPI_slide')
    .addBands(R.multiply(S).multiply(T_flood).rename('TPI_flood'))
    .set('system:time_start', t.millis());
}

// Série diária: 10 dias antes até 5 depois do evento
var dates = ee.List.sequence(-10, 5).map(function (d) { return ref.advance(d, 'day'); });
var series = ee.ImageCollection(dates.map(tpiAt));

// Classes: 0 Baixo, 1 Moderado, 2 Alto, 3 Crítico
function classes(img) { return img.gt(0.2).add(img.gt(0.4)).add(img.gt(0.6)); }
var pal = ['ffffb2', 'fecc5c', 'fd8d3c', 'bd0026'];
var peak = tpiAt(ref);
Map.centerObject(aoi, 8);
Map.addLayer(classes(peak.select('TPI_slide')).clip(aoi), {min: 0, max: 3, palette: pal}, 'TPI deslizamento');
Map.addLayer(classes(peak.select('TPI_flood')).clip(aoi), {min: 0, max: 3, palette: pal}, 'TPI enchente');

// Exporta a série como um GeoTIFF multibanda (uma banda por dia) para o app
Export.image.toDrive({
  image: series.select('TPI_slide').toBands().toFloat().clip(aoi),
  description: 'tpi_slide_series_rs', region: aoi, scale: 1000,
  fileFormat: 'GeoTIFF', formatOptions: {cloudOptimized: true}
});
```

### GEE 2. Antecipação do alerta, nível 1

```js
// Primeira data em que cada pixel virou Crítico (TPI acima de 0,6)
var firstCritical = series.map(function (img) {
  return ee.Image.constant(img.date().millis()).toDouble()
    .updateMask(img.select('TPI_slide').gt(0.6)).rename('t_crit');
}).min();

// Deslizamentos do catálogo com a data do evento (campo event_date em milissegundos)
var slides = ee.FeatureCollection('users/SEU_USUARIO/glc_rs_2024');
var lead = firstCritical.sampleRegions({collection: slides, scale: 1000})
  .map(function (f) {
    var hours = ee.Number(f.get('event_date')).subtract(f.get('t_crit')).divide(3600000);
    return f.set('lead_hours', hours);
  });
print('Antecipação média (h)', lead.aggregate_mean('lead_hours'));
print('Deslizamentos avisados antes', lead.filter(ee.Filter.gt('lead_hours', 0)).size(), 'de', slides.size());
```

### GEE 3. Suscetibilidade com Random Forest, nível 3a (Pessoa 4)

```js
var region = ee.Geometry.Rectangle([-58, -34, -39, -19]); // Sul e Sudeste

var dem = ee.Image('NASA/NASADEM_HGT/001').select('elevation');
var terrain = ee.Terrain.products(dem).select(['elevation', 'slope', 'aspect']);
var curv = dem.convolve(ee.Kernel.laplacian8()).rename('curvature');
var lc = ee.ImageCollection('MODIS/061/MCD12Q1').filterDate('2023-01-01', '2024-01-01')
  .first().select('LC_Type1').rename('landcover');
var rain = ee.ImageCollection('NASA/GPM_L3/IMERG_MONTHLY_V07')
  .filterDate('2001-01-01', '2025-01-01').select('precipitation').mean().rename('rain_mean');
var soil = ee.ImageCollection('NASA/SMAP/SPL4SMGP/007')
  .filterDate('2016-01-01', '2025-01-01').select('sm_rootzone_wetness').mean().rename('soil_mean');
var stack = terrain.addBands([curv, lc, rain, soil]).clip(region);

var slides = ee.FeatureCollection('users/SEU_USUARIO/glc_brasil')
  .map(function (f) { return f.set('label', 1); });
var negs = ee.FeatureCollection.randomPoints(region, 3000, 42)
  .filter(ee.Filter.bounds(slides.geometry().buffer(5000)).not())
  .map(function (f) { return f.set('label', 0); });

var samples = stack.sampleRegions({
  collection: slides.merge(negs), properties: ['label'], scale: 90, geometries: true
}).randomColumn('r', 7);
// Para a versão final: separar treino e teste por região, não ao acaso
var train = samples.filter(ee.Filter.lt('r', 0.7));
var test = samples.filter(ee.Filter.gte('r', 0.7));

var rf = ee.Classifier.smileRandomForest(200).setOutputMode('PROBABILITY')
  .train(train, 'label', stack.bandNames());
var T_ml = stack.classify(rf).rename('T_ml');

print('Importância das variáveis', rf.explain().get('importance'));
var scored = test.classify(rf, 'prob');
print('Amostra de teste', scored.limit(10));
Map.addLayer(T_ml, {min: 0, max: 1, palette: ['ffffb2', 'fd8d3c', 'bd0026']}, 'Suscetibilidade ML');
```

### GEE 4. Validação do proxy de HAND contra o MERIT Hydro (Pessoa 4)

```js
// Compara o proxy de HAND (NASADEM) com o HAND do MERIT Hydro, usado só como referência
var aoi = ee.Geometry.Rectangle([-52.5, -30.5, -50.5, -29.0]);
var dem = ee.Image('NASA/NASADEM_HGT/001').select('elevation');
var merit = ee.Image('MERIT/Hydro/v1_0_1').select('hnd').rename('merit');

function validate(radius) {
  var proxy = dem.subtract(dem.focalMin({radius: radius, units: 'meters'})).rename('proxy');
  var pair = proxy.addBands(merit).clip(aoi);

  // 1. Correlação de Pearson numa amostra
  var sample = pair.sample({region: aoi, scale: 90, numPixels: 5000, seed: 1});
  var corr = sample.reduceColumns(ee.Reducer.pearsonsCorrelation(), ['proxy', 'merit']);

  // 2. IoU da zona de risco (HAND abaixo de 5 m)
  var lowProxy = proxy.lt(5), lowMerit = merit.lt(5);
  var stats = lowProxy.and(lowMerit).rename('both')
    .addBands(lowProxy.or(lowMerit).rename('any'))
    .reduceRegion({reducer: ee.Reducer.sum(), geometry: aoi, scale: 90, maxPixels: 1e9});
  var iou = ee.Number(stats.get('both')).divide(stats.get('any'));

  return ee.Feature(null, {radius_m: radius, r: corr.get('correlation'), iou_low_hand: iou});
}

// Testa três raios e escolhe o que mais concorda com o MERIT
var results = ee.FeatureCollection([validate(1000), validate(1500), validate(3000)]);
print('Proxy x MERIT por raio', results);

// Mapa de diferença para o README
var proxy15 = dem.subtract(dem.focalMin({radius: 1500, units: 'meters'}));
Map.addLayer(proxy15.subtract(merit).clip(aoi),
  {min: -10, max: 10, palette: ['2166ac', 'f7f7f7', 'b2182b']}, 'Proxy menos MERIT (m)');
```

Como ler: o MERIT serve para escolher o raio do proxy. Fiquem com o raio de maior IoU. Correlação acima de 0,7 e IoU acima de 0,6 indicam um proxy confiável. Se a planície do Guaíba ficar muito vermelha no mapa de diferença, declarem isso como limitação no README.

### Python 1. Buscar e baixar NISAR (Pessoa 2)

```python
# pip install asf_search earthaccess rioxarray scipy
import os
import asf_search as asf

# Caso Washington: oeste do estado
aoi_wkt = 'POLYGON((-122.6 47.0, -121.5 47.0, -121.5 48.5, -122.6 48.5, -122.6 47.0))'

# Confira na documentação do asf_search o nome exato do dataset e do nível do produto NISAR
results = asf.search(dataset='NISAR', processingLevel='GCOV',
                     intersectsWith=aoi_wkt, start='2025-11-01', end='2026-01-31')
for r in results:
    p = r.properties
    print(p['fileID'], p['startTime'], p.get('pathNumber'), p.get('frameNumber'))

# Credenciais do NASA Earthdata em variáveis de ambiente, nunca no código
session = asf.ASFSession().auth_with_creds(os.environ['EDL_USER'], os.environ['EDL_PASS'])
results.download(path='data/raw/nisar', session=session)
```

### Python 2. Máscara de enchente com GCOV

```python
import numpy as np
import rioxarray as rxr
from scipy.ndimage import median_filter

# Backscatter HH em potência linear, mesmo track e frame, já recortado na área
pre = rxr.open_rasterio('data/nisar/gcov_hh_pre.tif').squeeze()
post = rxr.open_rasterio('data/nisar/gcov_hh_post.tif').squeeze()

def to_db(x):
    return 10 * np.log10(np.clip(x, 1e-6, None))

pre_db = median_filter(to_db(pre.values), size=3)                # filtro simples de speckle
post_db = median_filter(to_db(post.values), size=3)

water_before = pre_db < -15
water_now = post_db < -15
flood = (post_db - pre_db < -3) & water_now & ~water_before

# Atenção: em área urbana alagada a banda L pode CLAREAR (double bounce). Declarar como limitação.

out = pre.copy(data=flood.astype('uint8'))
out.rio.to_raster('data/cog/flood_nisar.tif', driver='COG')
water_now_da = pre.copy(data=water_now.astype('uint8'))
water_now_da.rio.to_raster('data/cog/water_nisar.tif', driver='COG')

res_x, res_y = pre.rio.resolution()
print('Área alagada (km2):', flood.sum() * abs(res_x * res_y) / 1e6)
```

### Python 3. Cicatrizes de deslizamento com coerência (GUNW)

```python
import numpy as np
import rioxarray as rxr
from scipy.ndimage import label

coh_ref = rxr.open_rasterio('data/nisar/coh_pair_sem_evento.tif').squeeze()
coh_evt = rxr.open_rasterio('data/nisar/coh_pair_com_evento.tif').squeeze()
slope = rxr.open_rasterio('data/aux/slope_nasadem.tif').squeeze().rio.reproject_match(coh_evt)

drop = coh_ref.values - coh_evt.values
# coh_ref acima de 0,4 descarta áreas que já eram incoerentes (vegetação densa, água)
cand = (drop > 0.3) & (slope.values > 15) & (coh_ref.values > 0.4)

# Remove manchas pequenas (menos de 10 pixels)
labels, n = label(cand)
sizes = np.bincount(labels.ravel())
keep = np.isin(labels, np.where(sizes >= 10)[0]) & (labels > 0)

coh_evt.copy(data=keep.astype('uint8')).rio.to_raster('data/cog/landslide_candidates.tif', driver='COG')
```

### Python 4. Validação contra OPERA DSWx-HLS

```python
import json
import numpy as np
import earthaccess
import rioxarray as rxr

earthaccess.login() # usa o .netrc ou pede login do Earthdata
granules = earthaccess.search_data(
    short_name='OPERA_L3_DSWX-HLS_V1',
    bounding_box=(-122.6, 47.0, -121.5, 48.5),
    temporal=('2025-12-08', '2025-12-20'))
files = earthaccess.download(granules, 'data/raw/opera')

water_nisar = rxr.open_rasterio('data/cog/water_nisar.tif').squeeze()
# Camada WTR: 0 sem água, 1 água aberta, 2 água parcial, 253 nuvem ou sombra, 255 sem dado
wtr = rxr.open_rasterio('data/raw/opera/EXEMPLO_B01_WTR.tif').squeeze() \
    .rio.reproject_match(water_nisar, resampling=0).values

valid = ~np.isin(wtr, [253, 255])
ref = np.isin(wtr, [1, 2]) & valid
pred = water_nisar.values.astype(bool) & valid

tp = int((ref & pred).sum())
fp = int((~ref & pred).sum())
fn = int((ref & ~pred).sum())
metrics = {
    'iou': tp / (tp + fp + fn),
    'f1': 2 * tp / (2 * tp + fp + fn),
    'cloud_pct': float(100 * (wtr == 253).sum() / (wtr != 255).sum()),
}
print(metrics)
json.dump(metrics, open('data/metrics.json', 'w'), indent=2)
```

### Python 5. Nível do rio com SWOT (Hydrocron)

```python
import io
import requests
import pandas as pd

# reach_id do trecho de rio: buscar no SWOT viewer do PO.DAAC (base SWORD)
url = 'https://soto.podaac.earthdatacloud.nasa.gov/hydrocron/v1/timeseries'
params = {
    'feature': 'Reach',
    'feature_id': 'REACH_ID_AQUI',
    'start_time': '2025-11-01T00:00:00Z',
    'end_time': '2026-01-31T00:00:00Z',
    'output': 'csv',
    'fields': 'reach_id,time_str,wse',
}
r = requests.get(url, params=params, timeout=60)
r.raise_for_status()

df = pd.read_csv(io.StringIO(r.json()['results']['csv']))
df = df[df['wse'] > -1e9] # remove valores de preenchimento
df.to_json('data/swot_river.json', orient='records')
print(df[['time_str', 'wse']])
```

## Layout do app

Uma tela única com mapa central e quatro abas na lateral, que seguem a história: alerta, confirmação, validação e impacto.

```text
+--------------------------------------------------------------------------+
| TIPPING POINT Rain warns. Radar confirms.          [Evento: ____ v]      |
+------------------------------------------+-------------------------------+
|                                          | [Alerta] [Radar] [Acertamos?] |
|                                          |                     [Impacto] |
|                                          |-------------------------------|
|                    MAPA (MapLibre)       |   CARD DE ALERTA              |
|                                          |   12 km2 passaram do tipping  |
|       camada TPI em 4 cores              |   point, 8.400 pessoas        |
|       ou swipe NISAR antes | depois      |   expostas                    |
|                                          |                               |
|                                          |   Gráfico: chuva IMERG diária |
|                                          |   e umidade SMAP no tempo     |
|                                          |                               |
|                                          |   Lista das áreas críticas    |
|                                          |   (clique = zoom no mapa)     |
+------------------------------------------+-------------------------------+
| TIMELINE |< > >|   D-5 D-4 D-3 D-2 D-1 [EVENTO] D+1 D+2                  |
+--------------------------------------------------------------------------+
| Legenda: Baixo | Moderado | Alto | Crítico     Fontes: NASA GPM, SMAP, NISAR |
+--------------------------------------------------------------------------+
```

### Abas e componentes

| Aba | No mapa | No painel lateral |
| --- | --- | --- |
| Alerta | TPI dia a dia, animado pela timeline, com trecho tracejado de previsão até D+3 | Card com km² e pessoas em risco, gráfico de chuva e solo, lista de áreas críticas |
| Radar | Swipe NISAR antes e depois, polígonos de enchente e cicatrizes | km² alagados, número de cicatrizes, data das passagens |
| Acertamos? | Pontos do catálogo e máscara OPERA sobre a máscara NISAR | IoU e F1, taxa de acerto do alerta, gráfico SWOT do rio, destaque "o óptico viu só X%" |
| Impacto | Black Marble antes e depois | Pessoas afetadas, km² alagados, queda de luz em percentual |
| Agora | TPI de hoje no Sul do Brasil e projeção D+1 a D+3 | "Atualizado há X h", data de cada fonte, km² críticos, pessoas expostas, últimas passagens NISAR |

### Fluxo do usuário na demo

1. Abre o app já no evento e aperta play. O mapa fica vermelho conforme a chuva acumula.
2. O card de alerta aparece quando áreas passam do tipping point.
3. Clica em "Confirmar com radar" e abre o swipe do NISAR.
4. Vai para "Acertamos?" e vê as métricas e o gráfico do rio.
5. Fecha em "Impacto" com o número de pessoas e o apagão.

### Diretrizes visuais

- Mapa base escuro, para o vermelho do crítico e o azul da água se destacarem.
- Quatro cores do TPI em escala sequencial acessível (amarelo claro até vermelho escuro).
- Água confirmada em azul, cicatrizes em roxo (laranja fica reservado para risco).
- Logos das missões NASA no rodapé, sem logo de empresa.

## Escalas de cores

Todas as paletas são seguras para daltônicos. O vermelho e o laranja ficam reservados para risco. Água é sempre azul.

#### Tipping Point Index (classes), base ColorBrewer YlOrRd

| Classe | TPI | Cor | Opacidade | Uso |
| --- | --- | --- | --- | --- |
| Baixo | 0 a 0,2 | #FFFFB2 | 0% na visão geral, 40% no zoom de detalhe | Não pinta o mapa todo de amarelo |
| Moderado | 0,2 a 0,4 | #FECC5C | 65% | |
| Alto | 0,4 a 0,6 | #FD8D3C | 65% | |
| Crítico | acima de 0,6 | #BD0026 | 75% | Contorno de 1 px na mesma cor |

#### Outras camadas

| Camada | Tipo de escala | Cores |
| --- | --- | --- |
| Previsão D+1 a D+3 | Mesmas classes do TPI | Mesmas cores, 50% de opacidade, hachura diagonal e rótulo "Previsão" |
| Probabilidade do Random Forest (T_ML) | Contínua 0 a 1 | YlOrRd contínuo, de #FFFFB2 a #BD0026 |
| Água permanente | Categórica | #9ECAE1, 60% |
| Enchente confirmada NISAR | Categórica | #2166AC, 75%, contorno #08306B |
| Cicatrizes de deslizamento | Categórica | #7B3294 (roxo), 80%, contorno branco de 1 px |
| Pontos do catálogo de deslizamentos | Símbolo | Círculo branco com borda preta, 6 px |
| Validação NISAR x OPERA | Categórica | Ambos #2166AC, só NISAR #92C5DE, só OPERA #F4A582, nuvem #BDBDBD com hachura |
| Queda de coerência | Contínua 0 a 1 | Roxos, de #F2F0F7 a #54278F |
| Black Marble, queda de luz | Contínua 0 a 100% | Viridis, de #440154 a #FDE725 |
| Diferença proxy de HAND menos MERIT | Divergente -10 a +10 m | #2166AC, #F7F7F7, #B2182B |

#### Gráficos

| Série | Estilo |
| --- | --- |
| Chuva diária (IMERG) | Barras #2166AC |
| Limiar P95 da chuva | Linha tracejada #BD0026 |
| Umidade do solo (SMAP) | Linha #8C510A, eixo da direita, 0 a 1 |
| Nível do rio (SWOT) | Linha com pontos #08306B, em metros |
| Trecho de previsão | Mesmo estilo, com 50% de opacidade e fundo cinza claro |
| Marcador "hoje" ou "evento" | Linha vertical #252525 com rótulo |

### Mapa

- Mapa base: escuro e sem rótulos (CARTO Dark Matter, dados OpenStreetMap). Os rótulos de cidades entram numa camada separada, por cima de tudo.
- Relevo: hillshade do NASADEM a 15% de opacidade, abaixo das camadas de risco. Ajuda a ler encostas.
- Projeção: o mapa usa Web Mercator (EPSG:3857). Exportem os PNGs em EPSG:3857 (crs: 'EPSG:3857' no export do GEE). Um PNG em EPSG:4326 colocado como image source fica desalinhado em áreas grandes, como o Sul do Brasil.
- Vista inicial: fitBounds na aoi do caso. Zoom mínimo 5 e máximo 13. Acima de 13 os pixels de 30 m viram blocos.
- Ordem das camadas, de baixo para cima:
  1. Mapa base
  2. Hillshade
  3. TPI ou previsão
  4. Água permanente
  5. Enchente confirmada
  6. Cicatrizes de deslizamento
  7. Limites municipais (linha branca, 0,5 px, 40%)
  8. Pontos do catálogo
  9. Rótulos de cidades
- Swipe do radar: antes à esquerda, depois à direita, cada lado com a data no topo.
- Clique no mapa: popup com município, classe do TPI, valores de R, S e T e data dos dados.

## Regras de visualização

1. Toda camada mostra a data dos dados, no horário local de Brasília, por exemplo "IMERG até 15/11 02:00".
2. Observado e previsto nunca se confundem. Previsão é sempre tracejada ou hachurada e tem rótulo.
3. Legenda sempre visível, com unidades, nome da fonte NASA e data.
4. Cor nunca carrega a informação sozinha. Áreas críticas também aparecem em lista com nome do lugar e número.
5. No máximo duas camadas de dados ao mesmo tempo, além do mapa base e do relevo.
6. Números com unidade e arredondados: km² com uma casa, pessoas arredondadas para a centena, horas inteiras.
7. Candidatos são chamados de candidatos. Cicatrizes de deslizamento nunca aparecem como "confirmadas".
8. Interface em inglês para os juízes, com nomes de lugares no original. Datas por extenso, como "May 2, 2024".
9. Texto mínimo de 12 px e contraste de pelo menos 4,5 para 1 sobre o mapa escuro.
10. Créditos no rodapé: missões NASA usadas e OpenStreetMap.

## Time, cronograma e entregáveis

O código congela domingo às 13h. Depois disso o time só trabalha na apresentação.

### Papéis

| Papel | Responsável | Entrega |
| --- | --- | --- |
| Product owner e pitch | Jhonata | Narrativa, escolha do evento, vídeo, decisões de corte |
| Chuva e solo | Pessoa 1 | IMERG, SMAP e TPI no GEE, antecipação (nível 1) e projeção com GEOS-FP (nível 2) |
| Radar | Pessoa 2 | Confirmação NISAR em Python |
| Front | Pessoa 3 | App React e integração dos dados |
| Terreno e validação | Pessoa 4 | NASADEM, proxy de HAND validado com MERIT, Random Forest (nível 3), GPW, OPERA, SWOT, catálogo, README |

### Cronograma

| Quando | Marco | Checkpoint |
| --- | --- | --- |
| Sáb 11h30 | Evento e área fechados, cobertura NISAR confirmada | Vai ou não vai com NISAR |
| Sáb 14h | Repositório no ar, dados baixados, esqueleto do app | Todos com dado real |
| Sáb 19h | Primeira versão do TPI, raio do HAND escolhido com o MERIT e primeiro mapa de mudança no radar | Corte de escopo: entra o ML (nível 3)? entra a previsão (nível 2)? |
| Sáb 23h | Tudo integrado no app, mesmo feio | Demo ponta a ponta |
| Dom 10h | Validação e painel de impacto | Números finais |
| Dom 13h | Código congelado | Só apresentação daqui em diante |
| Dom 13h a 18h | Vídeo, slides, README, resumo, capturas de tela | Revisão cruzada |
| Dom, 2h antes do prazo | Submissão | Confirmar horário na página do evento local |

### Escopo

MVP, precisa existir

- TPI com chuva, solo e declividade para uma região
- Um par NISAR mostrando dano confirmado
- Mapa com timeline e swipe
- Vídeo da demo

Extras, só se sobrar tempo

- Camada de enchente com proxy de HAND
- Validação com SWOT e Black Marble
- Bot do Telegram com /start e /simular (plus opcional, ver seção própria)

### Entregáveis da submissão

- Título e resumo em inglês, com a frase-tema
- Demo em vídeo curto ou slides (confirmar formato no guia de submissão)
- Repositório público e app no ar (Vercel ou GitHub Pages)
- Lista dos dados NASA usados
- Declaração de uso de IA

## Riscos, limitações e roadmap

O maior risco é não haver par NISAR sobre um evento brasileiro. Por isso esse check vem antes de tudo.

| Risco | Plano B |
| --- | --- |
| Sem NISAR no evento brasileiro | NISAR num evento recente fora do Brasil para a confirmação, e o Brasil para o alerta. HLS óptico para cicatrizes depois que a nuvem abrir |
| Processar InSAR demora | Usar GUNW pronto do ASF, sem processar do zero |
| Integração do front atrasa | Streamlit com leafmap, ou mapa estático com swipe |
| Limiares não batem com o evento | Calibrar no próprio evento e declarar isso como limitação |
| Apresentação fraca | Código congela domingo às 13h, sem exceção |
| Previsão histórica do GEOS-FP indisponível para o replay | Usar a chuva observada como "previsão perfeita" e declarar. Decidir com o time se o NOAA GFS entra |
| Produtos NISAR de Washington são pré-calibração (BETA) | Usar mudança relativa (antes e depois no mesmo frame), que tolera erro de calibração absoluta, e declarar |
| Proxy de HAND discorda do MERIT na planície | Ajustar o raio com o script GEE 4 e mostrar o mapa de diferença no README |
| Poucos deslizamentos no catálogo para treinar o Random Forest | Ampliar a região de treino para Sul e Sudeste, ou manter a regra manual e mostrar o ML como experimento |
| Job do modo Agora falha durante o julgamento | App mostra o último resultado bom com a data, e o Replay segue funcionando. Alerta de falha por e-mail do GitHub Actions |

### Limitações a declarar no README

- Limiares calibrados num único evento, sem validação estatística ampla.
- IMERG e SMAP têm resolução de cerca de 10 km. O detalhe vem do terreno. O HAND é um proxy simplificado do NASADEM, validado contra o MERIT Hydro.
- NISAR passa a cada 12 dias. A confirmação pode chegar dias após o evento.
- Perda de coerência em banda L também acontece por vegetação e chuva. Cicatrizes são candidatas, não confirmação de campo.
- A demo roda em replay, não em tempo real. No caso RS não há confirmação por radar, porque o evento é anterior ao NISAR.

### Roadmap

1. Pipeline automático que roda a cada atualização do IMERG.
2. Disparo da confirmação NISAR a cada nova passagem após um alerta.
3. Calibração dos limiares com o histórico do catálogo de deslizamentos e HAND completo calculado do NASADEM com pysheds.
4. Alertas por WhatsApp e e-mail para a Defesa Civil.
5. Integração com o produto OPERA de água superficial derivado do NISAR, quando estiver disponível.
