use tauri::webview::{PermissionKind, PermissionResponse};

fn request_geolocation_consent() -> bool {
    for (program, args) in [
        (
            "zenity",
            vec![
                "--question",
                "--title=Location access",
                "--text=gisneyland.github.io wants to access your location. Allow?",
            ],
        ),
        (
            "kdialog",
            vec![
                "--title",
                "Location access",
                "--yesno",
                "gisneyland.github.io wants to access your location. Allow?",
            ],
        ),
    ] {
        match std::process::Command::new(program).args(args).status() {
            Ok(status) => return status.success(),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
            Err(_) => return false,
        }
    }

    false
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let window_config = &app.config().app.windows[0];
            tauri::WebviewWindowBuilder::from_config(app.handle(), window_config)?
                .on_permission_request(|webview, permission| {
                    let is_hosted_site = webview
                        .url()
                        .map(|url| {
                            url.origin().ascii_serialization() == "https://gisneyland.github.io"
                        })
                        .unwrap_or(false);
                    if permission == PermissionKind::Geolocation
                        && is_hosted_site
                        && request_geolocation_consent()
                    {
                        PermissionResponse::Allow
                    } else {
                        PermissionResponse::Deny
                    }
                })
                .on_new_window(|url, _features| {
                    if matches!(url.scheme(), "http" | "https") {
                        let _ = std::process::Command::new("xdg-open")
                            .arg(url.as_str())
                            .spawn();
                    }
                    tauri::webview::NewWindowResponse::Deny
                })
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
