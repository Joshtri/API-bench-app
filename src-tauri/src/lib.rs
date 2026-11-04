mod bench;
mod url;

use std::path::Path;
use std::sync::{Arc, Mutex};

use serde::Serialize;
use tauri::ipc::Channel;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;
use tokio_util::sync::CancellationToken;
use ts_rs::TS;

use bench::{BenchEvent, Emit, RunRequest};

/// The run in progress, if any. Two runs at once would skew both.
#[derive(Default)]
struct Runner(Mutex<Option<CancellationToken>>);

/// Clears the running slot however the run ends.
struct Slot<'a>(&'a Runner);

impl Drop for Slot<'_> {
    fn drop(&mut self) {
        *self.0.0.lock().unwrap() = None;
    }
}

/// Starts a benchmark and streams its events to `on_event`. Resolves when
/// the run ends (done, cancelled or error). Rejects only if a run is
/// already going.
#[tauri::command]
async fn run_bench(runner: State<'_, Runner>, config: RunRequest, on_event: Channel<BenchEvent>) -> Result<(), String> {
    let cancel = {
        let mut slot = runner.0.lock().unwrap();
        if slot.is_some() {
            return Err("A benchmark is already running. Stop it first, two runs at once would skew both.".into());
        }
        let t = CancellationToken::new();
        *slot = Some(t.clone());
        t
    };
    let _slot = Slot(&runner);

    // If the page that started the run is gone, stop sending requests.
    let stop = cancel.clone();
    let emit: Emit = Arc::new(move |e| {
        if on_event.send(e).is_err() {
            stop.cancel();
        }
    });
    if let Err(message) = bench::run_bench(config, emit.clone(), cancel).await {
        emit(BenchEvent::Error { message });
    }
    Ok(())
}

/// Stops the current run. The run then sends a `cancelled` event.
#[tauri::command]
fn cancel_bench(runner: State<'_, Runner>) {
    if let Some(t) = runner.0.lock().unwrap().as_ref() {
        t.cancel();
    }
}

fn filter_for(file_name: &str) -> (&'static str, Vec<&'static str>) {
    match Path::new(file_name).extension().and_then(|e| e.to_str()) {
        Some("md") => ("Markdown", vec!["md"]),
        _ => ("JSON", vec!["json"]),
    }
}

/// Asks where to save `contents` with a native dialog. Returns false if
/// the user cancelled.
#[tauri::command]
async fn export_file(app: AppHandle, file_name: String, contents: String) -> Result<bool, String> {
    let (label, exts) = filter_for(&file_name);
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog().file().set_file_name(&file_name).add_filter(label, &exts).save_file(move |p| {
        let _ = tx.send(p);
    });
    let Some(path) = rx.await.map_err(|e| e.to_string())? else { return Ok(false) };
    let path = path.into_path().map_err(|e| e.to_string())?;
    std::fs::write(&path, contents).map_err(|e| format!("Could not save {}: {e}", path.display()))?;
    Ok(true)
}

#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
struct ImportedFile {
    name: String,
    text: String,
}

/// Lets the user pick a .json file with a native dialog and returns its
/// text, or null if they cancelled.
#[tauri::command]
async fn import_file(app: AppHandle) -> Result<Option<ImportedFile>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog().file().add_filter("JSON", &["json"]).pick_file(move |p| {
        let _ = tx.send(p);
    });
    let Some(path) = rx.await.map_err(|e| e.to_string())? else { return Ok(None) };
    let path = path.into_path().map_err(|e| e.to_string())?;
    let text = std::fs::read_to_string(&path).map_err(|e| format!("Could not read {}: {e}", path.display()))?;
    let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    Ok(Some(ImportedFile { name, text }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .manage(Runner::default())
        .invoke_handler(tauri::generate_handler![run_bench, cancel_bench, export_file, import_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
