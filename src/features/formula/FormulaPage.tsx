import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  ArrowLeft,
  Check,
  ClipboardPaste,
  Copy,
  ImagePlus,
  RotateCcw,
  Sigma,
  Sparkles,
  Upload,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import {
  getAiServiceConfig,
  recognizeFormula,
  type AiServiceConfig,
} from "../../shared/aiService";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_OPTIMIZE_THRESHOLD_BYTES = 1.5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 3_200;
const FORMULA_MODEL = "kimi-k2.6";
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/bmp",
]);

type PreparedFormulaImage = {
  dataUrl: string;
  originalBytes: number;
  outputBytes: number;
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string"
      ? resolve(reader.result)
      : reject(new Error("无法读取图片，请重新选择"));
    reader.onerror = () => reject(new Error("无法读取图片，请重新选择"));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("无法解析图片"));
    image.src = dataUrl;
  });
}

function dataUrlBytes(dataUrl: string): number {
  const encoded = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor(encoded.length * 3 / 4) - padding);
}

function formatImageBytes(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

async function readFormulaImage(file: File): Promise<PreparedFormulaImage> {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    throw new Error("仅支持 PNG、JPG、WEBP 或 BMP 图片");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("图片过大，请选择 8 MB 以内的公式截图");
  }
  const original = await readFileAsDataUrl(file);
  if (file.size <= IMAGE_OPTIMIZE_THRESHOLD_BYTES) {
    return { dataUrl: original, originalBytes: file.size, outputBytes: file.size };
  }

  try {
    const image = await loadImage(original);
    const largestDimension = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / largestDimension);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) return { dataUrl: original, originalBytes: file.size, outputBytes: file.size };

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const optimized = canvas.toDataURL("image/webp", 0.9);
    const outputBytes = dataUrlBytes(optimized);
    if (scale === 1 && outputBytes >= file.size) {
      return { dataUrl: original, originalBytes: file.size, outputBytes: file.size };
    }
    return { dataUrl: optimized, originalBytes: file.size, outputBytes };
  } catch {
    return { dataUrl: original, originalBytes: file.size, outputBytes: file.size };
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function FormulaPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [config, setConfig] = useState<AiServiceConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [imageName, setImageName] = useState("");
  const [imagePreparation, setImagePreparation] = useState("已准备识别");
  const [latex, setLatex] = useState("");
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "recognizing" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void getAiServiceConfig()
      .then(setConfig)
      .catch((error) => {
        setStatus("error");
        setMessage(errorMessage(error));
      })
      .finally(() => setConfigLoading(false));
  }, []);

  const selectImage = useCallback(async (file: File) => {
    try {
      const prepared = await readFormulaImage(file);
      setImageDataUrl(prepared.dataUrl);
      setImageName(file.name || "粘贴的公式截图");
      setImagePreparation(prepared.outputBytes < prepared.originalBytes * 0.9
        ? `已优化 ${formatImageBytes(prepared.originalBytes)} → ${formatImageBytes(prepared.outputBytes)}`
        : "已准备识别");
      setLatex("");
      setStatus("idle");
      setMessage("");
      setCopied(false);
    } catch (error) {
      setStatus("error");
      setMessage(errorMessage(error));
    }
  }, []);

  useEffect(() => {
    const pasteImage = (event: ClipboardEvent) => {
      const item = Array.from(event.clipboardData?.items ?? [])
        .find((candidate) => candidate.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (!file) return;
      event.preventDefault();
      void selectImage(file);
    };
    window.addEventListener("paste", pasteImage);
    return () => window.removeEventListener("paste", pasteImage);
  }, [selectImage]);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void selectImage(file);
    event.target.value = "";
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = Array.from(event.dataTransfer.files)
      .find((candidate) => candidate.type.startsWith("image/"));
    if (file) void selectImage(file);
    else {
      setStatus("error");
      setMessage("请拖入公式截图，而不是其他文件");
    }
  };

  const reset = () => {
    setImageDataUrl("");
    setImageName("");
    setImagePreparation("已准备识别");
    setLatex("");
    setStatus("idle");
    setMessage("");
    setCopied(false);
  };

  const recognize = async () => {
    if (!imageDataUrl || config?.provider !== "kimi" || !config.configured) return;
    const startedAt = performance.now();
    setStatus("recognizing");
    setMessage("Kimi 极速模型正在识别…");
    try {
      const result = await recognizeFormula(imageDataUrl);
      setLatex(result.latex);
      setStatus("success");
      const seconds = Math.max(0.1, (performance.now() - startedAt) / 1_000).toFixed(1);
      setMessage(`识别完成 · ${seconds} 秒，可继续校正或复制 LaTeX`);
    } catch (error) {
      setStatus("error");
      setMessage(errorMessage(error));
    }
  };

  const copyLatex = async () => {
    if (!latex) return;
    try {
      await navigator.clipboard.writeText(latex);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_600);
    } catch {
      setStatus("error");
      setMessage("复制失败，请手动选择 LaTeX 内容");
    }
  };

  const kimiReady = Boolean(config?.configured && config.provider === "kimi");

  return (
    <section className="formula-page">
      <header className="formula-page-header">
        <div>
          <Link className="formula-back-link" to="/tools"><ArrowLeft aria-hidden="true" size={14} />返回工具箱</Link>
          <h1>公式识别</h1>
          <p className="page-description">粘贴或导入公式截图，转换为可编辑、可复制的 LaTeX。</p>
        </div>
        <div className={kimiReady ? "formula-provider ready" : "formula-provider"}>
          <Sparkles aria-hidden="true" size={14} />
          {configLoading && <span>正在检查 AI 服务…</span>}
          {!configLoading && kimiReady && <span>{config?.displayName} · {FORMULA_MODEL} 极速</span>}
          {!configLoading && !kimiReady && <>
            <span>{config?.configured ? "当前模型不支持图片" : "尚未配置图片模型"}</span>
            <Link to="/settings">{config?.configured ? "切换到 Kimi" : "配置 Kimi"}</Link>
          </>}
        </div>
      </header>

      <div className="formula-workspace">
        <section className="formula-panel formula-input-panel">
          <header className="formula-panel-heading">
            <div className="formula-heading-icon"><ImagePlus aria-hidden="true" size={18} /></div>
            <div><h2>公式截图</h2><p>尽量只保留公式区域，识别会更准确。</p></div>
          </header>

          <div
            className={`formula-dropzone${dragging ? " dragging" : ""}${imageDataUrl ? " has-image" : ""}`}
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
            }}
            onDrop={onDrop}
          >
            {imageDataUrl ? <>
              <img src={imageDataUrl} alt="待识别的公式截图" />
              <div className="formula-image-meta"><span>{imageName}</span><span>{imagePreparation}</span></div>
            </> : <div className="formula-dropzone-empty">
              <span className="formula-paste-icon"><ClipboardPaste aria-hidden="true" size={25} /></span>
              <strong>粘贴一张公式截图</strong>
              <p>按 ⌘V，或将图片拖到这里</p>
              <span>支持 PNG、JPG、WEBP、BMP · 最大 8 MB</span>
            </div>}
          </div>

          <input
            ref={fileInput}
            className="sr-only"
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.bmp,image/png,image/jpeg,image/webp,image/bmp"
            aria-label="选择公式图片"
            onChange={onFileChange}
          />
          <div className="formula-input-actions">
            <button type="button" className="button-secondary" onClick={() => fileInput.current?.click()}>
              <Upload aria-hidden="true" size={16} />选择图片
            </button>
            {imageDataUrl && <button type="button" className="button-secondary" onClick={reset} disabled={status === "recognizing"}>
              <RotateCcw aria-hidden="true" size={15} />重新选择
            </button>}
            <button type="button" className="button-primary formula-recognize-button"
              disabled={!imageDataUrl || !kimiReady || status === "recognizing"}
              onClick={() => void recognize()}>
              <Sigma aria-hidden="true" size={17} />{status === "recognizing" ? "识别中…" : "识别公式"}
            </button>
          </div>
          <p className="formula-privacy-note">图片只会在你点击“识别公式”后发送给 Kimi，不会保存在公式识别页。</p>
        </section>

        <section className="formula-panel formula-output-panel">
          <header className="formula-panel-heading formula-output-heading">
            <div className="formula-heading-icon"><Sigma aria-hidden="true" size={18} /></div>
            <div><h2>LaTeX</h2><p>识别后可直接修改，预览会同步更新。</p></div>
            {latex && <button type="button" className="button-secondary" onClick={() => void copyLatex()}>
              {copied ? <Check aria-hidden="true" size={15} /> : <Copy aria-hidden="true" size={15} />}
              {copied ? "已复制" : "复制 LaTeX"}
            </button>}
          </header>

          {latex ? <div className="formula-result">
            <div className="formula-render-preview" aria-label="公式渲染预览">
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {`$$\n${latex}\n$$`}
              </ReactMarkdown>
            </div>
            <label className="formula-editor-label" htmlFor="formula-latex">LaTeX 源码</label>
            <textarea id="formula-latex" className="formula-code-editor" value={latex}
              spellCheck={false} onChange={(event) => { setLatex(event.target.value); setCopied(false); }} />
          </div> : <div className="formula-output-empty">
            <Sigma aria-hidden="true" size={29} />
            <strong>识别结果会显示在这里</strong>
            <p>你会同时看到渲染预览和可编辑的 LaTeX 源码。</p>
          </div>}

          {message && <p role={status === "error" ? "alert" : "status"}
            className={`formula-status ${status}`}>{message}</p>}
        </section>
      </div>
    </section>
  );
}
