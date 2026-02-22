use std::os::unix::process::CommandExt;
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
            // Kill entire process group (sidecar + all PTY children)
            unsafe {
                libc::killpg(child.id() as i32, libc::SIGTERM);
            }
            // Give processes 2 seconds to exit gracefully
            std::thread::sleep(Duration::from_secs(2));
            let _ = child.kill(); // SIGKILL if still alive
            let _ = child.wait();
        }
    }
}

fn wait_for_server(port: u16) -> bool {
    for _ in 0..50 {
        if std::net::TcpStream::connect(format!("127.0.0.1:{}", port)).is_ok() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    false
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

                let exe_dir = std::env::current_exe()
                    .ok()
                    .and_then(|p| p.parent().map(|p| p.to_path_buf()));

                if let Some(dir) = exe_dir {
                    let server_path = dir.join("bord-server");
                    if server_path.exists() {
                        let child = unsafe {
                            Command::new(server_path)
                                .env("BORD_PORT", sidecar_port.to_string())
                                .pre_exec(|| {
                                    // Create new process group with this process as leader
                                    libc::setpgid(0, 0);
                                    Ok(())
                                })
                                .spawn()
                        };

                        if let Ok(child) = child {
                            let sidecar_state = app.state::<Mutex<SidecarState>>();
                            sidecar_state.lock().unwrap().child = Some(child);

                            if wait_for_server(sidecar_port) {
                                app.state::<ServerPort>().0.store(sidecar_port, Ordering::Relaxed);
                            } else {
                                log::error!(
                                    "Sidecar server failed to start on port {}",
                                    sidecar_port
                                );
                            }
                        }
                    }
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
