//! Henosis desktop shell.
//!
//! The window loads the built web client (apps/web) with `src/bridge.js` injected first, so the
//! client finds `window.__HENOSIS_DESKTOP__` and never imports `@tauri-apps/*`. The shell polls the
//! Henosis server's inbox (`GET /api/notifications?user=<id>&unread=1`) for the signed-in person,
//! shows "Pending approvals · N" in the tray, a badge on the Dock or launcher, and a native
//! notification for every new approval or handoff that is not already on screen. Notifications
//! and the tray open the client on the right session through `henosis://p/<project>/s/<session>`.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashSet;
use std::sync::{Mutex, MutexGuard};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{
    image::Image,
    menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, State, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_notification::NotificationExt;

/// Injected into the main window before the client loads; defines `window.__HENOSIS_DESKTOP__`.
const BRIDGE_JS: &str = include_str!("../../src/bridge.js");
/// `henosis serve` without flags. Overridden by `HENOSIS_URL`, then by the `server` file in the
/// app's config directory, then by what the client reports through `setIdentity`.
const DEFAULT_SERVER: &str = "http://127.0.0.1:7700";
const POLL_EVERY: Duration = Duration::from_secs(15);

/// One row of `GET /api/notifications` (packages/server/src/notify.ts).
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Item {
    id: String,
    kind: String,
    #[serde(default)]
    title: String,
    #[serde(default)]
    body: String,
    /// henosis://p/<project>/s/<session>
    #[serde(default)]
    link: String,
    #[serde(default)]
    read: bool,
}

#[derive(Deserialize)]
struct Envelope {
    #[serde(default)]
    notifications: Vec<Item>,
}

#[derive(Default)]
struct Inbox {
    server: String,
    user: Option<String>,
    /// The session on screen, as the client reports it through `setRoute`.
    route: Option<(String, String)>,
    /// Ids already counted; a new id that is an approval or a handoff becomes a toast.
    seen: HashSet<String>,
    /// False until the first poll for this identity; that poll toasts one summary line.
    seeded: bool,
    /// Unread approvals and handoffs, newest last; the tray's first item opens the first.
    awaiting: Vec<Item>,
}

struct Shell {
    inbox: Mutex<Inbox>,
    /// Tags of toasts already shown by `notify`, so a re-sent one replaces nothing.
    toasted: Mutex<HashSet<String>>,
    /// The hash route of the `henosis://` link the app was launched with, read once by the client.
    launch_route: Mutex<Option<String>>,
    http: reqwest::Client,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Info {
    version: String,
    platform: &'static str,
    server_url: String,
    launch_route: Option<String>,
    poll_seconds: u64,
}

fn lock<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|e| e.into_inner())
}

// ---- commands the bridge calls -------------------------------------------------------------

#[tauri::command]
fn shell_info(app: AppHandle, shell: State<'_, Shell>) -> Info {
    Info {
        version: app.package_info().version.to_string(),
        platform: std::env::consts::OS,
        server_url: lock(&shell.inbox).server.clone(),
        launch_route: lock(&shell.launch_route).take(),
        poll_seconds: POLL_EVERY.as_secs(),
    }
}

/// Whom to poll for. `server_url` is the origin the client reaches `/api` on; `user_id` is the
/// identity in users.json. Either empty clears the tray and the badge.
#[tauri::command]
fn set_identity(
    app: AppHandle,
    shell: State<'_, Shell>,
    server_url: Option<String>,
    user_id: Option<String>,
) {
    let user = user_id.filter(|u| !u.is_empty());
    let (changed, signed_in) = {
        let mut g = lock(&shell.inbox);
        let server = server_url
            .filter(|s| !s.is_empty())
            .map(|s| s.trim_end_matches('/').to_string())
            .unwrap_or_else(|| g.server.clone());
        let changed = g.server != server || g.user != user;
        if changed {
            g.server = server;
            g.user = user;
            g.seen.clear();
            g.seeded = false;
            g.awaiting.clear();
        }
        (changed, g.user.is_some())
    };
    if !changed {
        return;
    }
    if signed_in {
        tauri::async_runtime::spawn(poll(app));
    } else {
        apply_tray(&app, 0, 0);
    }
}

/// The session the client shows; its inbox items are read while the window is focused, and the
/// client toasts its live events itself, so the poller leaves them alone.
#[tauri::command]
fn set_route(shell: State<'_, Shell>, project_id: Option<String>, session_id: Option<String>) {
    lock(&shell.inbox).route = match (project_id, session_id) {
        (Some(p), Some(s)) if !p.is_empty() && !s.is_empty() => Some((p, s)),
        _ => None,
    };
}

/// The open session's live pending count changed; look at the inbox now rather than in 15 s.
#[tauri::command]
fn set_pending(app: AppHandle, count: u32) {
    let _ = count;
    tauri::async_runtime::spawn(poll(app));
}

#[tauri::command]
fn refresh_inbox(app: AppHandle) {
    tauri::async_runtime::spawn(poll(app));
}

/// A native notification from the client (team chat, contentions, live approvals of the open
/// session). `tag` makes it idempotent for the life of the process.
#[tauri::command]
fn notify(app: AppHandle, shell: State<'_, Shell>, title: String, body: String, tag: Option<String>) {
    if let Some(tag) = tag {
        if !lock(&shell.toasted).insert(tag) {
            return;
        }
    }
    toast(&app, &title, &body);
}

// ---- the inbox poll --------------------------------------------------------------------------

async fn poll(app: AppHandle) {
    let shell = app.state::<Shell>();
    let (server, user) = {
        let g = lock(&shell.inbox);
        match &g.user {
            Some(u) => (g.server.clone(), u.clone()),
            None => return,
        }
    };
    let base = format!("{server}/api/notifications?user={}", encode(&user));
    let items = match shell.http.get(format!("{base}&unread=1")).send().await {
        Ok(res) => match res.json::<Envelope>().await {
            Ok(e) => e.notifications,
            Err(_) => return,
        },
        Err(_) => return,
    };
    let focused = app
        .get_webview_window("main")
        .and_then(|w| w.is_focused().ok())
        .unwrap_or(false);

    let mut toasts: Vec<(String, String)> = Vec::new();
    let mut mark_read: Vec<String> = Vec::new();
    let (approvals, handoffs) = {
        let mut g = lock(&shell.inbox);
        if g.user.as_deref() != Some(user.as_str()) {
            return; // the person changed while the request was out
        }
        let on_screen = g.route.as_ref().map(|(p, s)| format!("henosis://p/{p}/s/{s}"));
        let mut awaiting = Vec::new();
        for it in items.into_iter().filter(|i| !i.read) {
            let actionable = it.kind == "approval" || it.kind == "handoff";
            let shown = on_screen.as_deref().is_some_and(|p| it.link.starts_with(p));
            if shown && focused {
                mark_read.push(it.id.clone());
                continue;
            }
            if actionable && g.seeded && !shown && !g.seen.contains(&it.id) {
                toasts.push((it.title.clone(), it.body.clone()));
            }
            g.seen.insert(it.id.clone());
            if actionable {
                awaiting.push(it);
            }
        }
        let approvals = awaiting.iter().filter(|i| i.kind == "approval").count();
        let handoffs = awaiting.len() - approvals;
        if !g.seeded {
            g.seeded = true;
            if approvals + handoffs > 0 {
                toasts.push(("Henosis".to_string(), summary(approvals, handoffs)));
            }
        }
        g.awaiting = awaiting;
        (approvals, handoffs)
    };

    apply_tray(&app, approvals, handoffs);
    let _ = app.emit(
        "inbox",
        serde_json::json!({ "approvals": approvals, "handoffs": handoffs }),
    );
    if toasts.len() > 3 {
        let rest = toasts.len() - 2;
        toasts.truncate(2);
        toasts.push(("Henosis".to_string(), format!("{rest} more await you")));
    }
    for (title, body) in toasts {
        toast(&app, &title, &body);
    }
    if !mark_read.is_empty() {
        let _ = shell
            .http
            .post(&base)
            .json(&serde_json::json!({ "read": mark_read }))
            .send()
            .await;
    }
}

fn summary(approvals: usize, handoffs: usize) -> String {
    let mut parts = Vec::new();
    if approvals > 0 {
        parts.push(format!(
            "{approvals} pending approval{}",
            if approvals == 1 { "" } else { "s" }
        ));
    }
    if handoffs > 0 {
        parts.push(format!(
            "{handoffs} handoff{} offered to you",
            if handoffs == 1 { "" } else { "s" }
        ));
    }
    parts.join(", ")
}

fn toast(app: &AppHandle, title: &str, body: &str) {
    let _ = app.notification().builder().title(title).body(body).show();
}

// ---- tray, badge, window ---------------------------------------------------------------------

fn build_menu(app: &AppHandle, approvals: usize, handoffs: usize) -> tauri::Result<Menu<tauri::Wry>> {
    let pending = MenuItem::with_id(
        app,
        "pending",
        format!("Pending approvals · {approvals}"),
        true,
        None::<&str>,
    )?;
    let offered = MenuItem::with_id(
        app,
        "handoffs",
        format!("Handoffs offered · {handoffs}"),
        true,
        None::<&str>,
    )?;
    let sep = PredefinedMenuItem::separator(app)?;
    let open = MenuItem::with_id(app, "open", "Open Henosis", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Henosis", true, None::<&str>)?;
    let items: Vec<&dyn IsMenuItem<tauri::Wry>> = if handoffs > 0 {
        vec![&pending, &offered, &sep, &open, &quit]
    } else {
        vec![&pending, &sep, &open, &quit]
    };
    Menu::with_items(app, &items)
}

/// Tray text, tray icon (a dot when something awaits you), tooltip and the Dock/launcher badge.
fn apply_tray(app: &AppHandle, approvals: usize, handoffs: usize) {
    let total = approvals + handoffs;
    if let Some(tray) = app.tray_by_id("main") {
        if let Ok(menu) = build_menu(app, approvals, handoffs) {
            let _ = tray.set_menu(Some(menu));
        }
        let _ = tray.set_icon(Some(tray_icon(total > 0)));
        #[cfg(target_os = "macos")]
        let _ = tray.set_icon_as_template(true);
        let _ = tray.set_tooltip(Some(if total == 0 {
            "Henosis".to_string()
        } else {
            format!("Henosis · {total} awaiting you")
        }));
    }
    #[cfg(not(target_os = "windows"))]
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.set_badge_count(if total > 0 { Some(total as i64) } else { None });
    }
}

/// A 22 px sheet with its top-right corner folded (the Henosis mark, monochrome), and an apricot
/// dot in the lower-right corner when `attention`. Black with alpha on macOS, where the tray
/// treats it as a template image; linen elsewhere, for the dark trays of Windows and most
/// Linux desktops.
fn tray_icon(attention: bool) -> Image<'static> {
    const S: usize = 22;
    let ink: [u8; 3] = if cfg!(target_os = "macos") {
        [0, 0, 0]
    } else {
        [0xec, 0xe8, 0xe1]
    };
    let apricot: [u8; 3] = if cfg!(target_os = "macos") {
        ink
    } else {
        [0xe2, 0xc4, 0xa6]
    };
    let mut px = vec![0u8; S * S * 4];
    for y in 0..S {
        for x in 0..S {
            let fx = x as f32 + 0.5;
            let fy = y as f32 + 0.5;
            let in_sheet = (3.0..=19.0).contains(&fx) && (3.0..=19.0).contains(&fy);
            let beyond_crease = fx - fy > 10.0; // the cut-away corner above the (13,3)-(19,9) line
            let flap = fx >= 13.0 && fy <= 9.0 && !beyond_crease;
            let mut colour = ink;
            let mut alpha: u8 = if !in_sheet || beyond_crease {
                0
            } else if flap {
                150
            } else {
                255
            };
            if attention {
                let dx = fx - 16.5;
                let dy = fy - 16.5;
                let d2 = dx * dx + dy * dy;
                if d2 <= 4.6 * 4.6 {
                    alpha = 0;
                }
                if d2 <= 3.2 * 3.2 {
                    alpha = 255;
                    colour = apricot;
                }
            }
            let o = (y * S + x) * 4;
            px[o] = colour[0];
            px[o + 1] = colour[1];
            px[o + 2] = colour[2];
            px[o + 3] = alpha;
        }
    }
    Image::new_owned(px, S as u32, S as u32)
}

fn focus_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

/// henosis://p/<project>/s/<session> (or henosis://m/<team>) → the client's hash route.
fn route_of(url: &tauri::Url) -> Option<String> {
    if url.scheme() != "fold" {
        return None;
    }
    let host = url.host_str()?;
    let query = url.query().map(|q| format!("?{q}")).unwrap_or_default();
    Some(format!("#/{host}{}{query}", url.path()))
}

fn percent_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => out.push(b as char),
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

fn encode(s: &str) -> String {
    percent_encode(s)
}

/// `HENOSIS_URL`, else the one-line `server` file in the app's config directory, else localhost.
fn default_server(app: &AppHandle) -> String {
    if let Ok(v) = std::env::var("HENOSIS_URL") {
        if !v.trim().is_empty() {
            return v.trim().trim_end_matches('/').to_string();
        }
    }
    if let Ok(dir) = app.path().app_config_dir() {
        if let Ok(v) = std::fs::read_to_string(dir.join("server")) {
            if !v.trim().is_empty() {
                return v.trim().trim_end_matches('/').to_string();
            }
        }
    }
    DEFAULT_SERVER.to_string()
}

fn main() {
    tauri::Builder::default()
        // First, so a second launch (a henosis:// link on Windows or Linux) reaches this instance.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| focus_main(app)))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        // Auto-update (docs/16_desktop_release.md): the client drives the updater through the
        // global API and relaunches with the process plugin once the person chooses to restart.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            shell_info,
            set_identity,
            set_route,
            set_pending,
            refresh_inbox,
            notify
        ])
        .on_window_event(|window, event| match event {
            WindowEvent::Focused(true) => {
                tauri::async_runtime::spawn(poll(window.app_handle().clone()));
            }
            // On macOS the window closes into the tray and the Dock; Quit is in the tray menu.
            #[cfg(target_os = "macos")]
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                let _ = window.hide();
            }
            _ => {}
        })
        .setup(|app| {
            let handle = app.handle().clone();
            app.manage(Shell {
                inbox: Mutex::new(Inbox {
                    server: default_server(&handle),
                    ..Inbox::default()
                }),
                toasted: Mutex::new(HashSet::new()),
                launch_route: Mutex::new(None),
                http: reqwest::Client::builder()
                    .timeout(Duration::from_secs(10))
                    .build()?,
            });

            // The window is declared in tauri.conf.json with `create: false` so the bridge can
            // be attached as an initialization script here.
            let cfg = app
                .config()
                .app
                .windows
                .iter()
                .find(|w| w.label == "main")
                .cloned()
                .ok_or("tauri.conf.json has no window labelled main")?;
            WebviewWindowBuilder::from_config(app, &cfg)?
                .initialization_script(BRIDGE_JS)
                .build()?;

            TrayIconBuilder::with_id("main")
                .icon(tray_icon(false))
                .icon_as_template(true)
                .tooltip("Henosis")
                .menu(&build_menu(&handle, 0, 0)?)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "pending" | "handoffs" => {
                        focus_main(app);
                        let first = {
                            let shell = app.state::<Shell>();
                            let g = lock(&shell.inbox);
                            let kind = if event.id().as_ref() == "pending" { "approval" } else { "handoff" };
                            g.awaiting.iter().find(|i| i.kind == kind).map(|i| i.link.clone())
                        };
                        match first.as_deref().and_then(|l| l.parse::<tauri::Url>().ok()).and_then(|u| route_of(&u)) {
                            Some(route) => {
                                let _ = app.emit("deep-link", route);
                            }
                            None => {
                                let _ = app.emit("tray", "pending");
                            }
                        }
                    }
                    "open" => {
                        focus_main(app);
                        let _ = app.emit("tray", "open");
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            // henosis:// links. macOS registers the scheme from Info.plist at install; Windows and
            // Linux register it here as well so `tauri dev` builds answer links too.
            #[cfg(any(windows, target_os = "linux"))]
            {
                let _ = app.deep_link().register_all();
            }
            let link_handle = handle.clone();
            app.deep_link().on_open_url(move |event| {
                for url in event.urls() {
                    if let Some(route) = route_of(&url) {
                        let _ = link_handle.emit("deep-link", route);
                    }
                }
                focus_main(&link_handle);
            });
            if let Ok(Some(urls)) = app.deep_link().get_current() {
                if let Some(route) = urls.iter().find_map(route_of) {
                    *lock(&app.state::<Shell>().launch_route) = Some(route);
                }
            }

            // The inbox poll: every 15 s, plus on focus, identity and route changes.
            let poll_handle = handle.clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    tokio::time::sleep(POLL_EVERY).await;
                    poll(poll_handle.clone()).await;
                }
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Henosis")
        .run(|app, event| {
            // Clicking the Dock icon with the window hidden brings it back.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = event {
                focus_main(app);
            }
            #[cfg(not(target_os = "macos"))]
            let _ = (app, event);
        });
}
