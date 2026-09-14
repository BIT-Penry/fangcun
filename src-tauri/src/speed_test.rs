use reqwest::header::CONTENT_TYPE;
use serde::Serialize;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

const DOWNLOAD_URL: &str = "https://speed.cloudflare.com/__down";
const UPLOAD_URL: &str = "https://speed.cloudflare.com/__up";
const LATENCY_SAMPLE_COUNT: usize = 10;
const BANDWIDTH_SAMPLE_COUNT: usize = 3;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LatencyResult {
    latency_ms: f64,
    jitter_ms: f64,
    samples: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BandwidthResult {
    mbps: f64,
    bytes: usize,
    total_bytes: usize,
    duration_ms: f64,
    samples: usize,
    variation_percent: f64,
    loaded_latency_ms: f64,
    loaded_jitter_ms: f64,
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(8))
        .timeout(Duration::from_secs(30))
        .user_agent("Fangcun/0.1 network-speed-test")
        .build()
        .map_err(|error| format!("无法创建测速连接：{error}"))
}

fn cache_bust() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

async fn latency_sample(client: &reqwest::Client, sequence: usize) -> Result<f64, String> {
    let started = Instant::now();
    let cache_key = format!("{}-{sequence}", cache_bust());
    let url = format!("{DOWNLOAD_URL}?bytes=0&cb={cache_key}");
    client
        .get(url)
        .send()
        .await
        .map_err(|error| format!("延迟测试连接失败：{error}"))?
        .error_for_status()
        .map_err(|error| format!("测速服务暂时不可用：{error}"))?;
    Ok(started.elapsed().as_secs_f64() * 1_000.0)
}

async fn download_sample(
    client: &reqwest::Client,
    bytes: usize,
) -> Result<BandwidthResult, String> {
    let started = Instant::now();
    let url = format!("{DOWNLOAD_URL}?bytes={bytes}&cb={}", cache_bust());
    let payload = client
        .get(url)
        .send()
        .await
        .map_err(|error| format!("下载测试连接失败：{error}"))?
        .error_for_status()
        .map_err(|error| format!("测速服务暂时不可用：{error}"))?
        .bytes()
        .await
        .map_err(|error| format!("下载测试数据接收失败：{error}"))?;
    let duration = started.elapsed();
    if payload.len() < bytes {
        return Err("测速服务返回的数据不完整，请稍后重试".to_string());
    }
    Ok(bandwidth_result(payload.len(), duration))
}

async fn upload_sample(client: &reqwest::Client, bytes: usize) -> Result<BandwidthResult, String> {
    let payload = vec![0x5a; bytes];
    let started = Instant::now();
    let url = format!("{UPLOAD_URL}?bytes={bytes}&cb={}", cache_bust());
    client
        .post(url)
        .header(CONTENT_TYPE, "application/octet-stream")
        .body(payload)
        .send()
        .await
        .map_err(|error| format!("上传测试连接失败：{error}"))?
        .error_for_status()
        .map_err(|error| format!("测速服务暂时不可用：{error}"))?;
    Ok(bandwidth_result(bytes, started.elapsed()))
}

fn bandwidth_result(bytes: usize, duration: Duration) -> BandwidthResult {
    let seconds = duration.as_secs_f64().max(0.001);
    BandwidthResult {
        mbps: bytes as f64 * 8.0 / seconds / 1_000_000.0,
        bytes,
        total_bytes: bytes,
        duration_ms: seconds * 1_000.0,
        samples: 1,
        variation_percent: 0.0,
        loaded_latency_ms: 0.0,
        loaded_jitter_ms: 0.0,
    }
}

fn median(values: &mut [f64]) -> f64 {
    values.sort_by(f64::total_cmp);
    let middle = values.len() / 2;
    if values.len() % 2 == 0 {
        (values[middle - 1] + values[middle]) / 2.0
    } else {
        values[middle]
    }
}

fn percentile(values: &mut [f64], percentile: f64) -> f64 {
    values.sort_by(f64::total_cmp);
    let rank = percentile.clamp(0.0, 1.0) * (values.len() - 1) as f64;
    let lower = rank.floor() as usize;
    let upper = rank.ceil() as usize;
    if lower == upper {
        values[lower]
    } else {
        let weight = rank - lower as f64;
        values[lower] * (1.0 - weight) + values[upper] * weight
    }
}

fn jitter(values: &[f64]) -> f64 {
    if values.len() < 2 {
        return 0.0;
    }
    values
        .windows(2)
        .map(|pair| (pair[1] - pair[0]).abs())
        .sum::<f64>()
        / (values.len() - 1) as f64
}

fn choose_download_bytes(mbps: f64) -> usize {
    target_sample_bytes(mbps, 500_000, 20_000_000)
}

fn choose_upload_bytes(mbps: f64) -> usize {
    target_sample_bytes(mbps, 250_000, 6_000_000)
}

fn target_sample_bytes(mbps: f64, minimum: usize, maximum: usize) -> usize {
    let target = (mbps.max(0.1) * 1_000_000.0 / 8.0 * 1.2) as usize;
    target.clamp(minimum, maximum)
}

async fn download_sample_with_latency(
    client: &reqwest::Client,
    bytes: usize,
    sequence: usize,
) -> Result<(BandwidthResult, f64), String> {
    let latency_client = client.clone();
    let latency_task = tauri::async_runtime::spawn(async move {
        latency_sample(&latency_client, 10_000 + sequence).await
    });
    let bandwidth = download_sample(client, bytes).await;
    let loaded_latency = latency_task
        .await
        .map_err(|error| format!("下载负载延迟测试中断：{error}"))?;
    Ok((bandwidth?, loaded_latency?))
}

async fn upload_sample_with_latency(
    client: &reqwest::Client,
    bytes: usize,
    sequence: usize,
) -> Result<(BandwidthResult, f64), String> {
    let latency_client = client.clone();
    let latency_task = tauri::async_runtime::spawn(async move {
        latency_sample(&latency_client, 20_000 + sequence).await
    });
    let bandwidth = upload_sample(client, bytes).await;
    let loaded_latency = latency_task
        .await
        .map_err(|error| format!("上传负载延迟测试中断：{error}"))?;
    Ok((bandwidth?, loaded_latency?))
}

fn aggregate_bandwidth(
    probe: BandwidthResult,
    measurements: Vec<(BandwidthResult, f64)>,
) -> BandwidthResult {
    let mut bandwidth_points = measurements
        .iter()
        .map(|(result, _)| result.mbps)
        .collect::<Vec<_>>();
    let mean = bandwidth_points.iter().sum::<f64>() / bandwidth_points.len() as f64;
    let variance = bandwidth_points
        .iter()
        .map(|value| (value - mean).powi(2))
        .sum::<f64>()
        / bandwidth_points.len() as f64;
    let variation_percent = if mean > 0.0 {
        variance.sqrt() / mean * 100.0
    } else {
        0.0
    };
    let mut loaded_latency_points = measurements
        .iter()
        .map(|(_, latency)| *latency)
        .collect::<Vec<_>>();
    let loaded_jitter_ms = jitter(&loaded_latency_points);
    let loaded_latency_ms = median(&mut loaded_latency_points);
    let bytes = measurements.iter().map(|(result, _)| result.bytes).sum();
    let total_bytes = probe.total_bytes
        + measurements
            .iter()
            .map(|(result, _)| result.total_bytes)
            .sum::<usize>();
    let duration_ms = measurements
        .iter()
        .map(|(result, _)| result.duration_ms)
        .sum();
    BandwidthResult {
        mbps: percentile(&mut bandwidth_points, 0.9),
        bytes,
        total_bytes,
        duration_ms,
        samples: measurements.len(),
        variation_percent,
        loaded_latency_ms,
        loaded_jitter_ms,
    }
}

#[tauri::command]
pub async fn measure_network_latency() -> Result<LatencyResult, String> {
    let client = client()?;
    let _ = latency_sample(&client, 0).await?;
    let mut samples = Vec::with_capacity(LATENCY_SAMPLE_COUNT);
    for sequence in 1..=LATENCY_SAMPLE_COUNT {
        samples.push(latency_sample(&client, sequence).await?);
    }
    let jitter = jitter(&samples);
    let sample_count = samples.len();
    let latency = median(&mut samples);
    Ok(LatencyResult {
        latency_ms: latency,
        jitter_ms: jitter,
        samples: sample_count,
    })
}

#[tauri::command]
pub async fn measure_download_speed() -> Result<BandwidthResult, String> {
    let client = client()?;
    let probe = download_sample(&client, 250_000).await?;
    let sample_bytes = choose_download_bytes(probe.mbps);
    let mut measurements = Vec::with_capacity(BANDWIDTH_SAMPLE_COUNT);
    for sequence in 0..BANDWIDTH_SAMPLE_COUNT {
        measurements.push(download_sample_with_latency(&client, sample_bytes, sequence).await?);
    }
    Ok(aggregate_bandwidth(probe, measurements))
}

#[tauri::command]
pub async fn measure_upload_speed() -> Result<BandwidthResult, String> {
    let client = client()?;
    let probe = upload_sample(&client, 125_000).await?;
    let sample_bytes = choose_upload_bytes(probe.mbps);
    let mut measurements = Vec::with_capacity(BANDWIDTH_SAMPLE_COUNT);
    for sequence in 0..BANDWIDTH_SAMPLE_COUNT {
        measurements.push(upload_sample_with_latency(&client, sample_bytes, sequence).await?);
    }
    Ok(aggregate_bandwidth(probe, measurements))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn calculates_bandwidth_in_decimal_megabits() {
        let result = bandwidth_result(1_000_000, Duration::from_secs(1));
        assert_eq!(result.mbps, 8.0);
        assert_eq!(result.total_bytes, 1_000_000);
        assert_eq!(result.duration_ms, 1_000.0);
    }

    #[test]
    fn calculates_median_for_odd_and_even_samples() {
        assert_eq!(median(&mut [50.0, 10.0, 30.0]), 30.0);
        assert_eq!(median(&mut [40.0, 10.0, 20.0, 30.0]), 25.0);
    }

    #[test]
    fn calculates_percentile_and_jitter() {
        assert_eq!(percentile(&mut [10.0, 20.0, 30.0], 0.9), 28.0);
        assert_eq!(jitter(&[10.0, 14.0, 20.0]), 5.0);
    }

    #[test]
    fn scales_sample_size_with_connection_speed() {
        assert_eq!(choose_download_bytes(1.0), 500_000);
        assert_eq!(choose_download_bytes(60.0), 9_000_000);
        assert_eq!(choose_download_bytes(500.0), 20_000_000);
        assert_eq!(choose_upload_bytes(1.0), 250_000);
        assert_eq!(choose_upload_bytes(20.0), 3_000_000);
        assert_eq!(choose_upload_bytes(80.0), 6_000_000);
    }

    #[test]
    fn aggregates_multiple_bandwidth_samples() {
        let probe = bandwidth_result(250_000, Duration::from_secs_f64(0.2));
        let measurements = vec![
            (
                bandwidth_result(1_000_000, Duration::from_secs_f64(0.8)),
                10.0,
            ),
            (
                bandwidth_result(1_000_000, Duration::from_secs_f64(0.4)),
                20.0,
            ),
            (
                bandwidth_result(1_000_000, Duration::from_secs_f64(8.0 / 30.0)),
                30.0,
            ),
        ];

        let result = aggregate_bandwidth(probe, measurements);

        assert!((result.mbps - 28.0).abs() < 0.001);
        assert_eq!(result.samples, 3);
        assert_eq!(result.bytes, 3_000_000);
        assert_eq!(result.total_bytes, 3_250_000);
        assert_eq!(result.loaded_latency_ms, 20.0);
        assert_eq!(result.loaded_jitter_ms, 10.0);
        assert!(result.variation_percent > 40.0);
    }
}
