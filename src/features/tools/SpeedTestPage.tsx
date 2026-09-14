import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Cloud,
  Copy,
  Gauge,
  Radio,
  RotateCcw,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  measureDownloadSpeed,
  measureNetworkLatency,
  measureUploadSpeed,
  type BandwidthResult,
  type LatencyResult,
} from "../../shared/networkSpeed";

type TestPhase = "idle" | "latency" | "download" | "upload" | "complete" | "error";

const PHASE_PROGRESS: Record<TestPhase, number> = {
  idle: 0,
  latency: 16,
  download: 44,
  upload: 76,
  complete: 100,
  error: 0,
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatMbps(result: BandwidthResult | null): string {
  if (!result) return "—";
  if (result.mbps >= 100) return result.mbps.toFixed(0);
  if (result.mbps >= 10) return result.mbps.toFixed(1);
  return result.mbps.toFixed(2);
}

function formatMs(value: number | undefined): string {
  if (value === undefined) return "—";
  return value >= 100 ? value.toFixed(0) : value.toFixed(1);
}

function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.round(bytes / 1_000)} KB`;
}

function formatDuration(milliseconds: number): string {
  if (!milliseconds) return "—";
  return `${(milliseconds / 1_000).toFixed(1)} 秒`;
}

function connectionSummary(
  latency: LatencyResult | null,
  download: BandwidthResult | null,
  upload: BandwidthResult | null,
): { label: string; detail: string } {
  if (!latency || !download || !upload) {
    return { label: "等待测量", detail: "多轮采样会同时检查空闲与负载延迟，通常需要十余秒。" };
  }
  const loadedLatency = Math.max(download.loadedLatencyMs, upload.loadedLatencyMs);
  if (download.mbps >= 100 && latency.latencyMs < 40 && loadedLatency < 120) {
    return { label: "连接状态优秀", detail: "适合高清视频、云端协作和大文件传输。" };
  }
  if (download.mbps >= 30 && latency.latencyMs < 80 && loadedLatency < 250) {
    return { label: "连接状态良好", detail: "日常浏览、会议和高清视频都比较从容。" };
  }
  if (download.mbps >= 10 && loadedLatency < 500) {
    return { label: "满足日常使用", detail: "基础浏览与视频可用，繁重任务可能需要等待。" };
  }
  if (loadedLatency >= 500) {
    return { label: "负载下响应较慢", detail: "传输数据时延迟明显升高，视频会议或远程操作可能卡顿。" };
  }
  return { label: "网络速度偏慢", detail: "可尝试靠近路由器、暂停后台任务后重新测量。" };
}

export function SpeedTestPage() {
  const runId = useRef(0);
  const [phase, setPhase] = useState<TestPhase>("idle");
  const [latency, setLatency] = useState<LatencyResult | null>(null);
  const [download, setDownload] = useState<BandwidthResult | null>(null);
  const [upload, setUpload] = useState<BandwidthResult | null>(null);
  const [message, setMessage] = useState("");
  const [testedAt, setTestedAt] = useState("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => () => { runId.current += 1; }, []);

  const running = phase === "latency" || phase === "download" || phase === "upload";
  const summary = connectionSummary(latency, download, upload);
  const transferredBytes = (download?.totalBytes ?? 0) + (upload?.totalBytes ?? 0);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setElapsedMs((value) => value + 100), 100);
    return () => window.clearInterval(timer);
  }, [running]);

  const startTest = async () => {
    const currentRun = runId.current + 1;
    runId.current = currentRun;
    setLatency(null);
    setDownload(null);
    setUpload(null);
    setTestedAt("");
    setElapsedMs(0);
    setCopyState("idle");
    setMessage("");
    setPhase("latency");
    const startedAt = Date.now();
    try {
      const latencyResult = await measureNetworkLatency();
      if (runId.current !== currentRun) return;
      setLatency(latencyResult);
      setPhase("download");

      const downloadResult = await measureDownloadSpeed();
      if (runId.current !== currentRun) return;
      setDownload(downloadResult);
      setPhase("upload");

      const uploadResult = await measureUploadSpeed();
      if (runId.current !== currentRun) return;
      setUpload(uploadResult);
      setTestedAt(new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date()));
      setElapsedMs(Date.now() - startedAt);
      setPhase("complete");
    } catch (error) {
      if (runId.current !== currentRun) return;
      setMessage(errorMessage(error));
      setElapsedMs(Date.now() - startedAt);
      setPhase("error");
    }
  };

  const copyResult = async () => {
    if (!latency || !download || !upload) return;
    const text = [
      "方寸网速测量",
      `下载 ${formatMbps(download)} Mbps`,
      `上传 ${formatMbps(upload)} Mbps`,
      `延迟 ${formatMs(latency.latencyMs)} ms`,
      `抖动 ${formatMs(latency.jitterMs)} ms`,
      `下载负载延迟 ${formatMs(download.loadedLatencyMs)} ms`,
      `上传负载延迟 ${formatMs(upload.loadedLatencyMs)} ms`,
    ].join(" · ");
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("error");
    }
  };

  const phaseLabel = phase === "latency"
    ? "正在测量响应延迟"
    : phase === "download"
      ? "正在测量下载速度"
      : phase === "upload"
        ? "正在测量上传速度"
        : phase === "complete"
          ? `测量完成${testedAt ? ` · ${testedAt}` : ""}`
          : phase === "error"
            ? "测量未完成"
            : "准备开始";

  return (
    <section className="speed-test-page">
      <header className="speed-test-header">
        <div>
          <Link className="formula-back-link" to="/tools"><ArrowLeft aria-hidden="true" size={14} />返回工具箱</Link>
          <h1>网速测量</h1>
          <p className="page-description">快速了解当前网络的延迟、下载和上传表现。</p>
        </div>
        <div className="speed-test-provider"><Cloud aria-hidden="true" size={14} />Cloudflare 边缘节点</div>
      </header>

      <div className="speed-test-console">
        <section className="speed-test-overview">
          <div className={`speed-status-mark ${running ? "is-running" : ""}`} aria-hidden="true">
            <Gauge size={22} />
          </div>
          <div className="speed-summary-copy">
            <span className="speed-summary-kicker">连接概况</span>
            <h2>{phase === "error" ? "连接测试中断" : summary.label}</h2>
            <p>{phase === "error" ? message : summary.detail}</p>
          </div>
          <button
            type="button"
            className="button-primary speed-test-start"
            onClick={() => void startTest()}
            disabled={running}
          >
            {phase === "idle" ? <Radio aria-hidden="true" size={16} /> : <RotateCcw aria-hidden="true" size={15} />}
            {running ? "测量中…" : phase === "idle" ? "开始测量" : "重新测量"}
          </button>
        </section>

        <div className="speed-progress" aria-label={phaseLabel} aria-live="polite">
          <div className="speed-progress-meta"><span>{phaseLabel}</span><span>{PHASE_PROGRESS[phase]}%</span></div>
          <div className="speed-progress-track"><span style={{ width: `${PHASE_PROGRESS[phase]}%` }} /></div>
        </div>

        <section className="speed-results" aria-label="测速结果">
          <article className={phase === "download" ? "speed-primary-result is-active" : "speed-primary-result"}>
            <header><span><ArrowDown aria-hidden="true" size={17} />下载速度</span><small>网页与文件接收</small></header>
            <div className="speed-primary-value"><strong>{formatMbps(download)}</strong><b>Mbps</b></div>
            <p>{download ? `${download.samples} 轮采样 · 波动 ${download.variationPercent.toFixed(1)}% · 负载延迟 ${formatMs(download.loadedLatencyMs)} ms` : "完成测量后显示结果"}</p>
          </article>

          <div className="speed-secondary-results">
            <article className={phase === "upload" ? "speed-secondary-result is-active" : "speed-secondary-result"}>
              <header><ArrowUp aria-hidden="true" size={16} /><span>上传速度</span></header>
              <div><strong>{formatMbps(upload)}</strong><b>Mbps</b></div>
              <p>{upload ? `${upload.samples} 轮采样 · 波动 ${upload.variationPercent.toFixed(1)}% · 负载延迟 ${formatMs(upload.loadedLatencyMs)} ms` : "文件发送与云端同步"}</p>
            </article>
            <article className={phase === "latency" ? "speed-secondary-result is-active" : "speed-secondary-result"}>
              <header><Radio aria-hidden="true" size={15} /><span>网络延迟</span></header>
              <div><strong>{formatMs(latency?.latencyMs)}</strong><b>ms</b></div>
              <p>抖动 {formatMs(latency?.jitterMs)} ms · {latency?.samples ?? 0} 次采样</p>
            </article>
          </div>
        </section>

        <section className="speed-test-meta" aria-label="测试详情">
          <div><span>总耗时</span><strong>{formatDuration(elapsedMs)}</strong></div>
          <div><span>采样数据</span><strong>{formatBytes(transferredBytes)}</strong></div>
          <div><span>测量时间</span><strong>{testedAt || "—"}</strong></div>
          <button type="button" className="speed-copy-result" onClick={() => void copyResult()} disabled={phase !== "complete"}>
            {copyState === "copied" ? <Check aria-hidden="true" size={14} /> : <Copy aria-hidden="true" size={14} />}
            {copyState === "copied" ? "已复制" : copyState === "error" ? "复制失败" : "复制结果"}
          </button>
        </section>

        <footer className="speed-test-footnote">
          <span>测试说明</span>
          <p>方寸不保存测速结果。测试会连接 Cloudflare 并收发临时数据，实际结果会随 Wi-Fi、VPN 和后台任务变化。</p>
        </footer>
      </div>
    </section>
  );
}
