// popup.js
// Lógica do Conversor A/V Local.
// Usa o ffmpeg.wasm (classe FFmpeg, exposta globalmente como FFmpegWASM.FFmpeg
// pelo script ffmpeg/ffmpeg.js) para converter arquivos inteiramente no
// navegador, sem nenhuma requisição de rede: todo o "core" do ffmpeg
// (ffmpeg-core.js / ffmpeg-core.wasm) está embutido na própria extensão.

const fileInput = document.getElementById("fileInput");
const fileNameText = document.getElementById("fileNameText");
const toMp3Btn = document.getElementById("toMp3Btn");
const toMp4Btn = document.getElementById("toMp4Btn");
const progressWrap = document.getElementById("progressWrap");
const progressFill = document.getElementById("progressFill");
const statusText = document.getElementById("statusText");
const downloadLink = document.getElementById("downloadLink");

let selectedFile = null;
let ffmpeg = null;
let ffmpegReady = false;

// Converte um File do input em Uint8Array, formato que o ffmpeg.wasm
// usa para gravar arquivos no seu sistema de arquivos virtual (FS).
async function fileToUint8Array(file) {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

function setStatus(text) {
  statusText.textContent = text;
}

function setProgress(ratio) {
  const percent = Math.min(100, Math.max(0, Math.round(ratio * 100)));
  progressFill.style.width = percent + "%";
}

// Carrega o ffmpeg.wasm usando os arquivos locais da pasta ffmpeg/.
// chrome.runtime.getURL transforma o caminho relativo em uma URL
// chrome-extension://<id>/ffmpeg/ffmpeg-core.js, que é permitida pela
// CSP "script-src 'self'" do manifest (é a própria extensão).
async function initFfmpeg() {
  ffmpeg = new FFmpegWASM.FFmpeg();

  ffmpeg.on("progress", ({ progress }) => {
    setProgress(progress);
  });

  ffmpeg.on("log", ({ message }) => {
    console.log("[ffmpeg]", message);
  });

  progressWrap.hidden = false;
  setStatus("Carregando conversor (pode levar alguns segundos)...");

  await ffmpeg.load({
    coreURL: chrome.runtime.getURL("ffmpeg/ffmpeg-core.js"),
    wasmURL: chrome.runtime.getURL("ffmpeg/ffmpeg-core.wasm"),
  });

  ffmpegReady = true;
  progressWrap.hidden = true;
  setStatus("");
  updateButtonsState();
}

function updateButtonsState() {
  const hasFile = !!selectedFile;
  toMp3Btn.disabled = !hasFile || !ffmpegReady;
  toMp4Btn.disabled = !hasFile || !ffmpegReady;
}

fileInput.addEventListener("change", () => {
  selectedFile = fileInput.files[0] || null;
  fileNameText.textContent = selectedFile
    ? selectedFile.name
    : "Escolher arquivo (.mp4 ou .mp3)";
  downloadLink.hidden = true;
  updateButtonsState();
});

// Mostra o link de download com o resultado da conversão.
function showDownload(data, filename, mimeType) {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  downloadLink.href = url;
  downloadLink.download = filename;
  downloadLink.textContent = "Baixar " + filename;
  downloadLink.hidden = false;
}

async function runConversion(taskFn) {
  toMp3Btn.disabled = true;
  toMp4Btn.disabled = true;
  downloadLink.hidden = true;
  progressWrap.hidden = false;
  setProgress(0);

  try {
    await taskFn();
  } catch (err) {
    console.error(err);
    setStatus("Erro na conversão: " + err.message);
  } finally {
    updateButtonsState();
  }
}

// MP4 -> MP3: extrai apenas a faixa de áudio.
toMp3Btn.addEventListener("click", () => {
  runConversion(async () => {
    setStatus("Convertendo para MP3...");
    const inputData = await fileToUint8Array(selectedFile);

    await ffmpeg.writeFile("input.mp4", inputData);
    await ffmpeg.exec(["-i", "input.mp4", "-vn", "-q:a", "2", "output.mp3"]);
    const outputData = await ffmpeg.readFile("output.mp3");

    await ffmpeg.deleteFile("input.mp4");
    await ffmpeg.deleteFile("output.mp3");

    setStatus("Conversão concluída!");
    showDownload(outputData, "convertido.mp3", "audio/mpeg");
  });
});

// MP3 -> MP4: gera um vídeo com fundo preto (1080x1080) e o áudio embutido,
// com a mesma duração do áudio (-shortest corta o vídeo, que é "infinito",
// no tamanho do áudio, que é finito).
toMp4Btn.addEventListener("click", () => {
  runConversion(async () => {
    setStatus("Convertendo para MP4...");
    const inputData = await fileToUint8Array(selectedFile);

    await ffmpeg.writeFile("input.mp3", inputData);
    await ffmpeg.exec([
      "-f", "lavfi",
      "-i", "color=c=black:s=1080x1080",
      "-i", "input.mp3",
      "-shortest",
      "-c:v", "libx264",
      "-tune", "stillimage",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "192k",
      "output.mp4",
    ]);
    const outputData = await ffmpeg.readFile("output.mp4");

    await ffmpeg.deleteFile("input.mp3");
    await ffmpeg.deleteFile("output.mp4");

    setStatus("Conversão concluída!");
    showDownload(outputData, "convertido.mp4", "video/mp4");
  });
});

initFfmpeg().catch((err) => {
  console.error(err);
  setStatus("Erro ao carregar o conversor: " + err.message);
});
