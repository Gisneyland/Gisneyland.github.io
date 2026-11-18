fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let window_config = &app.config().app.windows[0];
            tauri::WebviewWindowBuilder::from_config(app.handle(), window_config)?
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
