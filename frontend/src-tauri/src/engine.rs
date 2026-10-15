use serde::Serialize;
use std::{
    fs::{self, OpenOptions},
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    path::Path,
    process::{Child, Command, Stdio},
    sync::Mutex,
    thread,
    time::{Duration, Instant},
};
use tauri::Manager;

#[derive(Clone, Serialize)]
pub struct Connection {
    pub url: String,
    pub token: String,
}

pub struct Engine {
    pub connection: Connection,
    child: Mutex<Option<Child>>,
    port: u16,
    _group: Option<crate::process_group::Group>,
}

impl Engine {
    pub fn start(app: &tauri::App) -> Result<Self, Box<dyn std::error::Error>> {
        if cfg!(debug_assertions) && std::env::var_os("DECHORD_ENGINE_DIR").is_none() {
            return Ok(Self {
                connection: Connection {
                    url: "http://127.0.0.1:8765".into(),
                    token: String::new(),
                },
                child: Mutex::new(None),
                port: 8765,
                _group: None,
            });
        }
        let resources = app.path().resource_dir()?.join("engine");
        let resources = if cfg!(debug_assertions) {
            std::env::var_os("DECHORD_ENGINE_DIR")
                .map(std::path::PathBuf::from)
                .unwrap_or(resources)
        } else {
            resources
        };
        let binary = resources.join(if cfg!(windows) {
            "dechord-engine.exe"
        } else {
            "dechord-engine"
        });
        if !binary.is_file() {
            return Err(format!("Bundled analysis engine is missing: {}", binary.display()).into());
        }
        let data = app.path().app_data_dir()?;
        fs::create_dir_all(&data)?;
        let log = OpenOptions::new()
            .create(true)
            .append(true)
            .open(data.join("engine.log"))?;
        let listener = TcpListener::bind("127.0.0.1:0")?;
        let port = listener.local_addr()?.port();
        let token = uuid::Uuid::new_v4().to_string();
        let connection = Connection {
            url: format!("http://127.0.0.1:{port}"),
            token,
        };
        let mut command = Command::new(&binary);
        command
            .current_dir(&data)
            .args(["--port", &port.to_string(), "--owned"])
            .env("DECHORD_DATA_DIR", &data)
            .env("DECHORD_ENGINE_TOKEN", &connection.token)
            .env("DECHORD_CHORD_ENGINE", "auto")
            .stdin(Stdio::piped())
            .stdout(Stdio::from(log.try_clone()?))
            .stderr(Stdio::from(log));
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000);
        }
        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            command.process_group(0);
        }
        drop(listener);
        let mut child = command.spawn()?;
        let group = match crate::process_group::Group::attach(&child) {
            Ok(group) => group,
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(error.into());
            }
        };
        let engine = Self {
            connection,
            child: Mutex::new(Some(child)),
            port,
            _group: Some(group),
        };
        let deadline = Instant::now() + Duration::from_secs(45);
        loop {
            if engine.health().is_ok() {
                return Ok(engine);
            }
            if engine
                .child
                .lock()
                .unwrap()
                .as_mut()
                .unwrap()
                .try_wait()?
                .is_some()
            {
                return Err(format!(
                    "Analysis engine exited during startup. See {}",
                    data.join("engine.log").display()
                )
                .into());
            }
            if Instant::now() >= deadline {
                return Err(
                    "Analysis engine startup timed out. See engine.log in the app data folder."
                        .into(),
                );
            }
            thread::sleep(Duration::from_millis(100));
        }
    }

    fn health(&self) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
        let mut stream = TcpStream::connect_timeout(
            &format!("127.0.0.1:{}", self.port).parse()?,
            Duration::from_secs(1),
        )?;
        stream.set_read_timeout(Some(Duration::from_secs(2)))?;
        stream.write_all(format!("GET /health HTTP/1.1\r\nHost: 127.0.0.1\r\nAuthorization: Bearer {}\r\nConnection: close\r\n\r\n", self.connection.token).as_bytes())?;
        let mut response = String::new();
        stream.take(65536).read_to_string(&mut response)?;
        let (headers, body) = response
            .split_once("\r\n\r\n")
            .ok_or("Invalid engine health response")?;
        if !headers.starts_with("HTTP/1.1 200") {
            return Err("Engine health request failed".into());
        }
        let health: serde_json::Value = serde_json::from_str(body)?;
        if health["service"] != "dechord" || health["version"] != env!("CARGO_PKG_VERSION") {
            return Err("Bundled engine version does not match this desktop app".into());
        }
        Ok(health)
    }

    pub fn stop(&self) {
        if let Some(mut child) = self.child.lock().unwrap().take() {
            // Closing the ownership pipe also handles an unexpected desktop termination.
            drop(child.stdin.take());
            let deadline = Instant::now() + Duration::from_secs(6);
            while Instant::now() < deadline {
                if matches!(child.try_wait(), Ok(Some(_))) {
                    return;
                }
                thread::sleep(Duration::from_millis(50));
            }
            crate::process_group::Group::terminate(&mut child);
        }
    }

    pub fn smoke_report(&self, path: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let health = self.health()?;
        let child = self.child.lock().unwrap();
        let pid = child
            .as_ref()
            .ok_or("Smoke test requires a bundled engine")?
            .id();
        let report = serde_json::json!({ "frontend_ready": true, "engine_pid": pid, "port": self.port, "health": health });
        fs::write(path, serde_json::to_vec_pretty(&report)?)?;
        Ok(())
    }
}

impl Drop for Engine {
    fn drop(&mut self) {
        self.stop();
    }
}

#[tauri::command]
pub fn backend_connection(app: tauri::AppHandle) -> Result<Connection, String> {
    app.try_state::<Engine>()
        .map(|engine| engine.connection.clone())
        .ok_or_else(|| app.state::<crate::StartupError>().0.clone())
}

#[tauri::command]
pub fn desktop_ready(app: tauri::AppHandle, engine: tauri::State<Engine>) -> Result<(), String> {
    if let Some(path) = std::env::var_os("DECHORD_SMOKE_REPORT") {
        engine
            .smoke_report(Path::new(&path))
            .map_err(|e| e.to_string())?;
        app.exit(0);
    }
    Ok(())
}
