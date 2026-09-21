# Conversor A/V Local

Extensão de Chrome (Manifest V3) que converte arquivos MP4 → MP3 e MP3 → MP4
inteiramente no navegador, usando [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm).
Nenhum arquivo é enviado para nenhum servidor: a conversão roda 100% local.

## Estrutura

```
conversor-av-local/
├── manifest.json      # Configuração da extensão (Manifest V3)
├── popup.html          # Interface exibida ao clicar no ícone da extensão
├── popup.js             # Lógica de conversão (usa o ffmpeg.wasm)
├── style.css             # Estilo do popup
└── ffmpeg/                # Build oficial do ffmpeg.wasm, embutido localmente
    ├── ffmpeg.js               # @ffmpeg/ffmpeg (UMD)
    ├── 814.ffmpeg.js           # Worker gerado pelo @ffmpeg/ffmpeg
    ├── ffmpeg-core.js          # @ffmpeg/core (UMD, single-thread)
    └── ffmpeg-core.wasm        # Binário WebAssembly do ffmpeg
```

Os arquivos em `ffmpeg/` vêm, sem modificação, dos pacotes npm oficiais
`@ffmpeg/ffmpeg@0.12.15` e `@ffmpeg/core@0.12.10`. Eles são carregados via
`chrome.runtime.getURL(...)`, então tudo roda dentro da própria extensão —
por isso o Manifest V3 (que bloqueia scripts remotos) permite.

## Como instalar (modo desenvolvedor)

1. Abra `chrome://extensions` no Chrome.
2. Ative o "Modo do desenvolvedor" (canto superior direito).
3. Clique em "Carregar sem compactação" ("Load unpacked").
4. Selecione a pasta `conversor-av-local/`.
5. Clique no ícone da extensão na barra do navegador para abrir o popup.

## Como usar

1. Clique em "Escolher arquivo" e selecione um `.mp4` ou `.mp3`.
2. Clique em "Converter para MP3" (se escolheu um vídeo) ou
   "Converter para MP4" (se escolheu um áudio).
3. Aguarde a barra de progresso. Ao terminar, um link "Baixar ..." aparece.

MP3 → MP4 gera um vídeo com fundo preto (1080x1080) contendo o áudio, com a
mesma duração do arquivo original.

## Permissões

O `manifest.json` não declara nenhuma permissão (`"permissions": []`): a
extensão só precisa do próprio popup e de arquivos que já estão dentro dela,
então nenhum acesso extra ao navegador é necessário. JSON não aceita
comentários, então essa explicação fica aqui no README.

## Notas técnicas

- CSP do manifest (`script-src 'self' 'wasm-unsafe-eval'; object-src 'self'`)
  permite carregar e compilar o WebAssembly do ffmpeg sem violar as regras
  do Manifest V3.
- `ffmpeg-core.wasm` tem ~32 MB (é o motor completo do ffmpeg compilado para
  WebAssembly), por isso o primeiro carregamento do popup pode levar alguns
  segundos.
- Toda a conversão acontece em um Web Worker dentro da extensão; nenhuma
  requisição de rede é feita (`"permissions": []`, sem `host_permissions`).
