mod engine;
mod process_group;
use tauri::Manager;

struct StartupError(String);

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
    tauri::Builder::default()
        .setup(|app| {
            match engine::Engine::start(app) {
                Ok(engine) => {
                    app.manage(engine);
                }
                Err(error) => {
                    app.manage(StartupError(error.to_string()));
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_lyrics_file,
            engine::backend_connection,
            engine::desktop_ready
        ])
        .build(tauri::generate_context!())
        .expect("failed to start DeChord")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                if let Some(engine) = app.try_state::<engine::Engine>() {
                    engine.stop();
                }
            }
        });
}
