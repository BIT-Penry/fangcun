import { invoke } from "@tauri-apps/api/core";

export type LatencyResult = {
  latencyMs: number;
  jitterMs: number;
  samples: number;
};

export type BandwidthResult = {
  mbps: number;
  bytes: number;
  totalBytes: number;
  durationMs: number;
  samples: number;
  variationPercent: number;
  loadedLatencyMs: number;
  loadedJitterMs: number;
};

export function measureNetworkLatency(): Promise<LatencyResult> {
  return invoke("measure_network_latency");
}

export function measureDownloadSpeed(): Promise<BandwidthResult> {
  return invoke("measure_download_speed");
}

export function measureUploadSpeed(): Promise<BandwidthResult> {
  return invoke("measure_upload_speed");
}
