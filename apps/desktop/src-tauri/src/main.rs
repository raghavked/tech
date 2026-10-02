// Fold desktop shell. The window loads the built web client; the tray shows the pending
// approvals count for the signed-in user and opens the client on the right session.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};

/// Called by the web client (via `invoke`) whenever its pending-approval count changes, so the
/// tray item reads "Pending approvals · 2". Wire it from the client with
/// `window.__TAURI__.core.invoke("set_pending", { count })` guarded by `"__TAURI__" in window`.
#[tauri::command]
fn set_pending(app: tauri::AppHandle, count: u32) {
    if let Some(item) = app.state::<TrayItems>().pending.lock().ok() {
        let _ = item.set_text(format!("Pending approvals · {count}"));
    }
}

struct TrayItems {
    pending: std::sync::Mutex<MenuItem<tauri::Wry>>,
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![set_pending])
        .setup(|app| {
            let pending = MenuItem::with_id(app, "pending", "Pending approvals · 0", true, None::<&str>)?;
            let open = MenuItem::with_id(app, "open", "Open Fold", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&pending, &open, &quit])?;
            app.manage(TrayItems { pending: std::sync::Mutex::new(pending) });
            TrayIconBuilder::new()
                .icon(app.default_window_icon().cloned().expect("icon"))
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    // The client listens for "tray:pending" and opens its inbox of approvals.
                    "pending" => {
                        focus_main(app);
                        let _ = app.emit("tray:pending", ());
                    }
                    "open" => focus_main(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;
            // fold://p/<project>/s/<session> from a notification → the client's hash route.
            use tauri_plugin_deep_link::DeepLinkExt;
            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                for url in event.urls() {
                    let route = format!("#/{}{}", url.host_str().unwrap_or(""), url.path());
                    let _ = handle.emit("deep-link", route);
                }
                focus_main(&handle);
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Fold");
}

fn focus_main(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
    }
}
