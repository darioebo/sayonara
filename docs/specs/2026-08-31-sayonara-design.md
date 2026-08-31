# Sayonara — Design

**Data:** 2026-08-31
**Nome do produto:** Sayonara
**Stack:** HTML + CSS + JS vanilla (ES modules), PWA.

## Propósito

Ferramenta instalável (PWA) para apresentações em reuniões (Zoom, Google Meet, WhatsApp). O utilizador partilha uma janela/tab dedicada com um layout de **3 zonas**, com notas .md renderizadas ao lado dos slides, permitindo ler notas e apresentar sem sair da janela partilhada e sem usar notas externas.

## Problema que resolve

Ao partilhar o ecrã em reuniões, o utilizador não consegue usar notas, apresentar em tela cheia nem mexer noutras partes do PC. O Sayonara cria uma janela específica para partilhar com tudo integrado.

## Layout de partilha (3 zonas)

```
┌─────────────────┬─────────────┐
│                 │  Notas .md   │  ← topo direito (renderizadas)
│   Zona Esq.     ├─────────────┤
│  (conteúdo)     │  Zona Dir.   │  ← baixo direito (conteúdo)
│                 │  (conteúdo)  │
└─────────────────┴─────────────┘
```

- Grid de 2 colunas; a coluna direita tem um grid interno de 2 linhas.
- **Espaçamento (gap) visível** entre zonas para deixar a divisão clara.
- Painéis **redimensionáveis** em modo edição (arrastar divisores com Pointer Events, 1:1).

## Funcionalidades

1. **Página inicial (Home)** — centro de arranque:
   - **Histórico de cenários em cards** (nome, data, mini-preview de ficheiros, ações Abrir/Duplicar/Editar/Eliminar) + barra de procura.
   - **Criar novo cenário** (botão primário destacado).
   - Estado vazio com CTA se não houver cenários.
2. **Preparação de cenário (modal/sheet):** nome à escolha + ficheiros:
   - **Notas** → ficheiro `.md` (conteúdo persistido no cenário).
   - **Slide** → ficheiro `.pdf`.
   - **Zonas de conteúdo** → URL, PDF ou imagem.
   - **Guardar** → persiste no histórico.
3. **Workspace (`/workspace/:id`)** — 3 zonas montadas:
   - Modo **edição**: redimensionar painéis, trocar conteúdo, voltar à Home.
   - Modo **apresentação** (Fullscreen API): tela cheia, só as 3 zonas + espaçamentos, UI oculta; statusbar discreta auto-ocultável ("Pág. X / Y").
4. **Notas .md** — só leitura, renderizadas (títulos, listas, etc.), com rolagem suave.
5. **Sincronização notas ↔ slides (PDF por página):**
   - Formato próprio de notas com marcadores de página.
   - A página atual do PDF (via pdf.js) faz o renderizador mostrar o bloco `/Pág. N/` correspondente, com rolagem automática suave.
6. **Cenários guardados** em IndexedDB; histórico com procura, ordenado por mais recente; ações duplicar/editar/eliminar.

## Formato de notas com marcadores de página

```md
# Título

---
## Pág. 1
- boletos
---
## Pág. 2
- métricas
---
```

Se não houver PDF sincronizado ou marcadores, as notas mostram-se por completo e o apresentador lê livremente.

## Modelo de cenário (persistido em IndexedDB)

```json
{
  "id": "uuid",
  "name": "Reunião semanal — Estado",
  "createdAt": "ISO",
  "updatedAt": "ISO",
  "notes": { "fileName": "notas.md", "content": "<texto .md persistido>" },
  "left":       { "type": "url|pdf|image|none", "src": "...", "fileName": "slides.pdf", "handle": "FileHandle?" },
  "rightBottom": { "type": "url|pdf|image|none", "src": "..." }
}
```

- Notas: conteúdo `.md` persistido (offline, abertura instantânea). Nome do ficheiro registado.
- PDFs/imagens: referência via **File System Access API** (FileHandle) quando disponível; fallback de "reselecionar ficheiro" com aviso claro. Ficheiros grandes não são copiados por defeito.

## PWA

- `manifest.webmanifest` + `sw.js` (cache/offline).
- Instalável a partir da Home.

## Dependências

- `pdf.js` (Mozilla), servido localmente em `vendor/pdfjs/`.
- Renderizador de markdown próprio (parser pequeno) — sem framework.

## Estados & erros

- Ao abrir PDF/imagem sem referência disponível: ação clara de "reselecionar ficheiro", nunca zona em branco sem explicação.
- Voltar à Home a partir do workspace não destrói o estado corrente.
- Confirmação apenas para acções genuinamente destrutivas (ex.: eliminar cenário).

## Identidade visual (Apple Design)

- **Tipografia:** sistema (`system-ui`), tracking negativo em títulos grandes, leading apertado em displays, confortável no corpo; escala em `rem`/`em`.
- **Materiais:** barras/nav translúcidas (`backdrop-filter: blur + saturate`); statusbar discreta.
- **Cores:** neutros + acento pontual; modo claro/escuro (`prefers-color-scheme`).
- **Motion:** springs criticamente amortecidos (damping ~1.0); feedback no pointer-down; transições interruptíveis a partir do valor atual; entradas/saídas pela mesma direcção; rolagem de notas suave; respeito por `prefers-reduced-motion` e `prefers-reduced-transparency`.
- **Cenários em cards** na Home.
- **Simplicidade:** duas acções claras na Home (criar + abrir do histórico).

## Estrutura de ficheiros

```
sayonara/
├── index.html
├── manifest.webmanifest
├── sw.js
├── css/base.css, app.css
├── js/main.js, layout.js, markdown.js, pdf.js, viewers.js, scenarios.js, presentation.js
├── vendor/pdfjs/
├── icons/
└── docs/specs/
```

## Aceitação

1. Home mostra cards de cenários + criar novo.
2. Criar cenário: nome + notas .md + slides .pdf + zonas; guarda no histórico.
3. Workspace com 3 zonas e espaçamentos, redimensionáveis em edição.
4. Modo apresentação em tela cheia com statusbar de página.
5. Sincronização: mudar de página no PDF alterna as notas `/Pág. N/`.
6. PWA instalável.
