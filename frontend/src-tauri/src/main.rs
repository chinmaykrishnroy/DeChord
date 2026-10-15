#[tauri::command]
fn read_lyrics_file(path: String) -> Result<String, String> {
    let path = std::path::Path::new(&path);
    let extension = path.extension().and_then(|value| value.to_str()).unwrap_or("").to_ascii_lowercase();
    if extension != "lrc" && extension != "txt" { return Err("Choose an LRC or text lyrics file.".into()); }
    let metadata = std::fs::metadata(path).map_err(|error| error.to_string())?;
    if !metadata.is_file() || metadata.len() > 2 * 1024 * 1024 { return Err("Lyrics files must be smaller than 2 MB.".into()); }
    std::fs::read_to_string(path).map_err(|error| error.to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![read_lyrics_file])
        .run(tauri::generate_context!())
        .expect("failed to run DeChord");
}
