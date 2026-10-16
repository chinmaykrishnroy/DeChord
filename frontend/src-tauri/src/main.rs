#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod engine;
mod process_group;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Manager;

struct StartupError(String);
struct StartupControl(AtomicBool);

fn smoke_directory() -> Option<std::path::PathBuf> {
    std::env::var_os("DECHORD_SMOKE_REPORT").map(|report| {
        std::path::Path::new(&report)
            .parent()
            .filter(|path| path.is_absolute())
            .expect("DECHORD_SMOKE_REPORT must name an absolute file path")
            .to_path_buf()
    })
}

#[tauri::command]
fn read_lyrics_file(path: String) -> Result<String, String> {
    let path = std::path::Path::new(&path);
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if extension != "lrc" && extension != "txt" {
        return Err("Choose an LRC or text lyrics file.".into());
    }
    let metadata = std::fs::metadata(path).map_err(|error| error.to_string())?;
    if !metadata.is_file() || metadata.len() > 2 * 1024 * 1024 {
        return Err("Lyrics files must be smaller than 2 MB.".into());
    }
    std::fs::read_to_string(path).map_err(|error| error.to_string())
}

fn main() {
    let smoke_root = smoke_directory();
    let mut context = tauri::generate_context!();
    if smoke_root.is_some() {
        // Windows known-folder APIs ignore APPDATA environment overrides.
        // Build the test webview explicitly with a separate absolute profile.
        for window in &mut context.config_mut().app.windows {
            window.create = false;
        }
    }
    tauri::Builder::default()
        .setup(move |app| {
            app.manage(StartupControl(AtomicBool::new(false)));
            let handle = app.handle().clone();
            // Native imports and first-run compilation must not block the window.
            std::thread::spawn(move || match engine::Engine::start(&handle) {
                Ok(engine) => {
                    if handle.state::<StartupControl>().0.load(Ordering::SeqCst) {
                        engine.stop();
                    } else {
                        handle.manage(engine);
                    }
                }
                Err(error) => {
                    handle.manage(StartupError(error.to_string()));
                }
            });
            if let Some(root) = &smoke_root {
                let config = app
                    .config()
                    .app
                    .windows
                    .first()
                    .ok_or("No app window configured")?;
                tauri::WebviewWindowBuilder::from_config(app, config)?
                    .data_directory(root.join("webview"))
                    .build()?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_lyrics_file,
            engine::backend_connection,
            engine::desktop_ready
        ])
        .build(context)
        .expect("failed to start DeChord")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                app.state::<StartupControl>()
                    .0
                    .store(true, Ordering::SeqCst);
                if let Some(engine) = app.try_state::<engine::Engine>() {
                    engine.stop();
                }
            }
        });
}
