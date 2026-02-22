#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
#[cfg(unix)]
use std::os::unix::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::sync::atomic::{AtomicU16, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::Manager;

struct ServerPort(AtomicU16);

struct SidecarState {
    child: Option<Child>,
}

#[tauri::command]
fn get_server_port(state: tauri::State<'_, ServerPort>) -> u16 {
    state.0.load(Ordering::Relaxed)
}

impl Drop for SidecarState {
    fn drop(&mut self) {
        if let Some(ref mut child) = self.child {
            #[cfg(unix)]
            {
                // Kill entire process group (sidecar + all PTY children)
                unsafe {
                    libc::killpg(child.id() as i32, libc::SIGTERM);
                }
                // Give processes 2 seconds to exit gracefully
                std::thread::sleep(Duration::from_secs(2));
            }
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

fn wait_for_server(port: u16) -> bool {
    for _ in 0..150 {
        if std::net::TcpStream::connect(format!("127.0.0.1:{}", port)).is_ok() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    false
}

fn sidecar_name() -> &'static str {
    if cfg!(windows) {
        "bord-server.exe"
    } else {
        "bord-server"
    }
}

fn resolve_server_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    let name = sidecar_name();
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            candidates.push(exe_dir.join(name));
        }
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join(name));
        candidates.push(resource_dir.join("resources").join(name));
        candidates.push(resource_dir.join("dist").join(name));
    }

    candidates.into_iter().find(|path| path.exists())
}

fn resolve_schema_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("schema.sql"));
        candidates.push(resource_dir.join("resources").join("schema.sql"));
    }

    candidates.into_iter().find(|path| path.exists())
}

#[cfg(unix)]
fn ensure_executable(path: &Path) {
    if let Ok(metadata) = std::fs::metadata(path) {
        let mut permissions = metadata.permissions();
        let mode = permissions.mode();
        if mode & 0o111 == 0 {
            permissions.set_mode(mode | 0o755);
            let _ = std::fs::set_permissions(path, permissions);
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(Mutex::new(SidecarState { child: None }))
        .manage(ServerPort(AtomicU16::new(0)))
        .invoke_handler(tauri::generate_handler![get_server_port])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // In release mode, spawn the Bun sidecar
            if !cfg!(debug_assertions) {
                let sidecar_port = {
                    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
                    listener.local_addr().unwrap().port()
                };

                if let Some(server_path) = resolve_server_path(&app.handle()) {
                    #[cfg(unix)]
                    ensure_executable(&server_path);

                    let mut cmd = Command::new(&server_path);
                    cmd.env("BORD_PORT", sidecar_port.to_string());

                    if let Ok(app_data_dir) = app.path().app_data_dir() {
                        let _ = std::fs::create_dir_all(&app_data_dir);
                        cmd.env("BORD_DB_PATH", app_data_dir.join("bord.db"));
                    }

                    if let Some(schema_path) = resolve_schema_path(&app.handle()) {
                        cmd.env("BORD_SCHEMA_PATH", schema_path);
                    }

                    #[cfg(windows)]
                    {
                        use std::os::windows::process::CommandExt;
                        const CREATE_NO_WINDOW: u32 = 0x08000000;
                        cmd.creation_flags(CREATE_NO_WINDOW);
                    }

                    #[cfg(unix)]
                    let child = unsafe {
                        cmd.pre_exec(|| {
                            libc::setpgid(0, 0);
                            Ok(())
                        })
                        .spawn()
                    };
                    #[cfg(not(unix))]
                    let child = cmd.spawn();

                    match child {
                        Ok(child) => {
                            let sidecar_state = app.state::<Mutex<SidecarState>>();
                            sidecar_state.lock().unwrap().child = Some(child);

                            if wait_for_server(sidecar_port) {
                                app.state::<ServerPort>()
                                    .0
                                    .store(sidecar_port, Ordering::Relaxed);
                            } else {
                                log::error!(
                                    "Sidecar server failed to start on port {}",
                                    sidecar_port
                                );
                            }
                        }
                        Err(err) => {
                            log::error!(
                                "Failed to spawn sidecar from {}: {}",
                                server_path.display(),
                                err
                            );
                        }
                    }
                } else {
                    log::error!("Could not locate bundled bord-server binary");
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
