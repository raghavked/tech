//! Henosis desktop shell.
//!
//! The window loads the built web client (apps/web) with `src/bridge.js` injected first, so the
//! client finds `window.__HENOSIS_DESKTOP__` and never imports `@tauri-apps/*`. The shell polls the
//! Henosis server's inbox (`GET /api/notifications?user=<id>&unread=1`) for the signed-in person
//! and keeps the items: the tray lists them, not counts (serif who · verb · what · age, five per
//! section then "and N more… in the queue"), with Quick open (the last five sessions and rooms by
//! name, Inbox, Approvals queue, New session…), Pause notifications (an hour, until tomorrow,
//! until you say; the icon dims with a moon), Open Henosis (⌥⇧H / Ctrl+Shift+H) and Quit. The
//! badge on the Dock or launcher counts approvals and handoffs only, never mentions. A native
//! notification carries the one grammar (title who · verb · what, body where and what it means
//! for you) and its tag replaces; under a ratings rule it opens the notice rather than approving
//! blind. Every row, Quick open entry and notification is a `henosis://p/<project>/s/<session>`
//! route into the client (design/henosis SCREENS.md §20, BACKLOG.md L1).
//!
//! The window is 1280×840. On macOS the titlebar is an overlay (hiddenInset traffic lights in the
//! rail, the client's title row is the drag region); on Windows the window is undecorated and the
//! client draws the 36 px titlebar. Closing hides to the tray on both; Quit is in the tray menu.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashSet;
use std::sync::{Mutex, MutexGuard};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::{
    image::Image,
    menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, State, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_global_shortcut::ShortcutState;
use tauri_plugin_notification::NotificationExt;

/// Injected into the main window before the client loads; defines `window.__HENOSIS_DESKTOP__`.
const BRIDGE_JS: &str = include_str!("../../src/bridge.js");
/// `henosis serve` without flags. Overridden by `HENOSIS_URL`, then by the `server` file in the
/// app's config directory, then by what the client reports through `setIdentity`.
const DEFAULT_SERVER: &str = "http://127.0.0.1:7700";
const POLL_EVERY: Duration = Duration::from_secs(15);
/// Rows per tray section before "and N more… in the queue" (desktop-tray).
const PER_SECTION: usize = 5;
/// Quick open lists this many sessions and rooms by name.
const RECENTS: usize = 5;
/// The global shortcut that brings Henosis forward: ⌥⇧H on macOS, Ctrl+Shift+H elsewhere.
#[cfg(target_os = "macos")]
const OPEN_SHORTCUT: &str = "Alt+Shift+H";
#[cfg(not(target_os = "macos"))]
const OPEN_SHORTCUT: &str = "Ctrl+Shift+H";

/// One row of `GET /api/notifications` (packages/server/src/notify.ts): the one grammar.
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Item {
    id: String,
    kind: String,
    #[serde(default)]
    title: String,
    #[serde(default)]
    body: String,
    /// who · verb · what: "Ana's agent" · "asks to" · "git push · irreversible"
    #[serde(default)]
    who: String,
    #[serde(default)]
    verb: String,
    #[serde(default)]
    what: String,
    /// The same tag replaces an earlier notice.
    #[serde(default)]
    tag: String,
    /// The client's hash route to the notice, `#/p/<project>/s/<session>`.
    #[serde(default)]
    route: String,
    /// henosis://p/<project>/s/<session>
    #[serde(default)]
    link: String,
    /// An approval under a ratings rule: the notice opens; nothing approves blind.
    #[serde(default)]
    ratings: bool,
    /// Seconds since it was sent, by the server's clock when it answered.
    #[serde(default)]
    age: u64,
    #[serde(default)]
    read: bool,
}

#[derive(Deserialize)]
struct Envelope {
    #[serde(default)]
    notifications: Vec<Item>,
}

/// A Quick open entry the client mirrors from its recents (`setRecents`).
#[derive(Clone, Debug, Deserialize, Serialize)]
struct Recent {
    #[serde(default)]
    kind: String,
    #[serde(default)]
    title: String,
    #[serde(default)]
    route: String,
    #[serde(default)]
    at: f64,
}

/// Pause notifications: approvals still badge; only the toasts and the sound stop.
#[derive(Clone, Copy, Debug, Default)]
enum Pause {
    #[default]
    Off,
    Until(Instant),
    UntilSaid,
}

#[derive(Default)]
struct Inbox {
    server: String,
    user: Option<String>,
    /// The person's name, for "Nothing awaits you, Ana."
    name: Option<String>,
    /// The session on screen, as the client reports it through `setRoute`.
    route: Option<(String, String)>,
    /// Ids already counted; a new id that is an approval or a handoff becomes a toast.
    seen: HashSet<String>,
    /// False until the first poll for this identity; that poll toasts one summary line.
    seeded: bool,
    /// Every unread item the tray lists, oldest first: approvals, handoffs and mentions.
    items: Vec<Item>,
    /// The last sessions and rooms by name, newest first.
    recents: Vec<Recent>,
    pause: Pause,
}

impl Inbox {
    fn of_kind<'a>(&'a self, kind: &'a str) -> impl Iterator<Item = &'a Item> + 'a {
        self.items.iter().filter(move |i| i.kind == kind)
    }
    fn count(&self, kind: &str) -> usize {
        self.of_kind(kind).count()
    }
    /// The badge: decisions only.
    fn badge(&self) -> usize {
        self.count("approval") + self.count("handoff")
    }
    fn paused(&mut self) -> bool {
        match self.pause {
            Pause::Off => false,
            Pause::UntilSaid => true,
            Pause::Until(t) => {
                if Instant::now() < t {
                    true
                } else {
                    self.pause = Pause::Off;
                    false
                }
            }
        }
    }
}

struct Shell {
    inbox: Mutex<Inbox>,
    /// Tags of toasts already shown, so a repeat replaces (is not shown twice) for the life of the process.
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
/// identity in users.json; `name` is how the tray addresses the person. Either of the first two
/// empty clears the tray and the badge.
#[tauri::command]
fn set_identity(
    app: AppHandle,
    shell: State<'_, Shell>,
    server_url: Option<String>,
    user_id: Option<String>,
    name: Option<String>,
) {
    let user = user_id.filter(|u| !u.is_empty());
    let (changed, signed_in) = {
        let mut g = lock(&shell.inbox);
        let server = server_url
            .filter(|s| !s.is_empty())
            .map(|s| s.trim_end_matches('/').to_string())
            .unwrap_or_else(|| g.server.clone());
        let changed = g.server != server || g.user != user;
        g.name = name.filter(|n| !n.trim().is_empty());
        if changed {
            g.server = server;
            g.user = user;
            g.seen.clear();
            g.seeded = false;
            g.items.clear();
        }
        (changed, g.user.is_some())
    };
    if !changed {
        apply_tray(&app);
        return;
    }
    if signed_in {
        tauri::async_runtime::spawn(poll(app));
    } else {
        apply_tray(&app);
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

/// The last sessions and rooms the client opened, newest first, for Quick open.
#[tauri::command]
fn set_recents(app: AppHandle, shell: State<'_, Shell>, items: Vec<Recent>) {
    {
        let mut g = lock(&shell.inbox);
        let mut items = items;
        items.sort_by(|a, b| b.at.partial_cmp(&a.at).unwrap_or(std::cmp::Ordering::Equal));
        items.truncate(RECENTS);
        g.recents = items;
    }
    apply_tray(&app);
}

/// A native notification from the client (team chat, contentions, live approvals of the open
/// session). `tag` makes it idempotent for the life of the process: a repeat replaces, never doubles.
#[tauri::command]
fn notify(app: AppHandle, shell: State<'_, Shell>, title: String, body: String, tag: Option<String>) {
    if let Some(tag) = tag {
        if !lock(&shell.toasted).insert(tag) {
            return;
        }
    }
    if lock(&shell.inbox).paused() {
        return;
    }
    toast(&app, &title, &body);
}

// ---- the Windows titlebar's caption buttons (the window is undecorated there) ----------------

#[tauri::command]
fn win_minimize(app: AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.minimize();
    }
}

#[tauri::command]
fn win_toggle_maximize(app: AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = if w.is_maximized().unwrap_or(false) {
            w.unmaximize()
        } else {
            w.maximize()
        };
    }
}

/// Close hides to the tray; Quit lives in the tray menu.
#[tauri::command]
fn win_close(app: AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.hide();
    }
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

    let mut toasts: Vec<(String, String, String)> = Vec::new();
    let mut mark_read: Vec<String> = Vec::new();
    let paused = {
        let mut g = lock(&shell.inbox);
        if g.user.as_deref() != Some(user.as_str()) {
            return; // the person changed while the request was out
        }
        let on_screen = g.route.as_ref().map(|(p, s)| format!("henosis://p/{p}/s/{s}"));
        let mut listed = Vec::new();
        for it in items.into_iter().filter(|i| !i.read) {
            let listed_kind = matches!(it.kind.as_str(), "approval" | "handoff" | "mention");
            let decision = it.kind == "approval" || it.kind == "handoff";
            let shown = on_screen.as_deref().is_some_and(|p| it.link.starts_with(p));
            if shown && focused {
                mark_read.push(it.id.clone());
                continue;
            }
            // Banners for anything not on screen: decisions, mentions, blocked, contention
            // (done and plan are the client's, which opts in per kind).
            let banner = decision || matches!(it.kind.as_str(), "mention" | "blocked" | "contention");
            if banner && g.seeded && !shown && !g.seen.contains(&it.id) {
                toasts.push((toast_tag(&it), toast_title(&it), it.body.clone()));
            }
            g.seen.insert(it.id.clone());
            if listed_kind {
                listed.push(it);
            }
        }
        let approvals = listed.iter().filter(|i| i.kind == "approval").count();
        let handoffs = listed.iter().filter(|i| i.kind == "handoff").count();
        if !g.seeded {
            g.seeded = true;
            if approvals + handoffs > 0 {
                toasts.push((
                    format!("summary:{}", g.seen.len()),
                    "Henosis".to_string(),
                    summary(approvals, handoffs),
                ));
            }
        }
        g.items = listed;
        g.paused()
    };

    apply_tray(&app);
    emit_inbox(&app);
    if !paused {
        // The same tag replaces: a notice shown once is not shown again as it ages in the inbox.
        let mut fresh = Vec::new();
        {
            let mut shown = lock(&shell.toasted);
            for (tag, title, body) in toasts {
                if shown.insert(tag) {
                    fresh.push((title, body));
                }
            }
        }
        if fresh.len() > 3 {
            let rest = fresh.len() - 2;
            fresh.truncate(2);
            fresh.push(("Henosis".to_string(), format!("{rest} more await you")));
        }
        for (title, body) in fresh {
            toast(&app, &title, &body);
        }
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

/// The banner's title: the three words of the grammar, or the server's title for an older server.
fn toast_title(it: &Item) -> String {
    if it.who.is_empty() {
        it.title.clone()
    } else {
        format!("{} {} {}", it.who, it.verb, it.what)
    }
}

fn toast_tag(it: &Item) -> String {
    if it.tag.is_empty() {
        it.id.clone()
    } else {
        it.tag.clone()
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

/// One notification, in the OS's own style and place. The notification plugin draws no buttons
/// on the desktop, so the one action is the click, which brings Henosis forward where the OS
/// does that; under a ratings rule the body says the notice opens to rate and approve.
fn toast(app: &AppHandle, title: &str, body: &str) {
    let _ = app.notification().builder().title(title).body(body).show();
}

/// `{ approvals, handoffs, mentions, items, paused }` to the client after every poll.
fn emit_inbox(app: &AppHandle) {
    let payload = {
        let shell = app.state::<Shell>();
        let mut g = lock(&shell.inbox);
        let paused = g.paused();
        serde_json::json!({
            "approvals": g.count("approval"),
            "handoffs": g.count("handoff"),
            "mentions": g.count("mention"),
            "items": g.items,
            "paused": paused,
        })
    };
    let _ = app.emit("inbox", payload);
}

// ---- tray, badge, window ---------------------------------------------------------------------

/// "now", "2m", "3h", "2d": the age at the right of a row.
fn age_label(seconds: u64) -> String {
    match seconds {
        s if s < 60 => "now".to_string(),
        s if s < 3600 => format!("{}m", s / 60),
        s if s < 86_400 => format!("{}h", s / 3600),
        s => format!("{}d", s / 86_400),
    }
}

/// A row as the menu draws it: who · verb · what · age. A native menu has one face, so the serif
/// who is the client's; here the words carry the grammar.
fn row_text(it: &Item) -> String {
    if it.who.is_empty() {
        format!("{} · {}", it.title, age_label(it.age))
    } else {
        format!("{} {} {} · {}", it.who, it.verb, it.what, age_label(it.age))
    }
}

/// The tray menu: items, not counts (desktop-tray).
fn build_menu(app: &AppHandle, inbox: &mut Inbox) -> tauri::Result<Menu<tauri::Wry>> {
    let paused = inbox.paused();
    let mut owned: Vec<Box<dyn IsMenuItem<tauri::Wry>>> = Vec::new();

    if inbox.items.is_empty() {
        let who = inbox
            .name
            .as_deref()
            .and_then(|n| n.split_whitespace().next())
            .map(|n| format!(", {n}"))
            .unwrap_or_default();
        owned.push(Box::new(MenuItem::with_id(
            app,
            "empty",
            format!("Nothing awaits you{who}."),
            false,
            None::<&str>,
        )?));
    }
    for (kind, header, more_id) in [
        ("approval", "Pending approvals", "more:approvals"),
        ("handoff", "Handoffs offered", "more:handoffs"),
        ("mention", "Mentions", "more:mentions"),
    ] {
        let rows: Vec<&Item> = inbox.of_kind(kind).collect();
        if rows.is_empty() {
            continue; // Mentions only when there are any
        }
        owned.push(Box::new(MenuItem::with_id(
            app,
            format!("head:{kind}"),
            format!("{header} · {}", rows.len()),
            false,
            None::<&str>,
        )?));
        for it in rows.iter().take(PER_SECTION) {
            owned.push(Box::new(MenuItem::with_id(
                app,
                format!("item:{}", it.id),
                row_text(it),
                true,
                None::<&str>,
            )?));
        }
        if rows.len() > PER_SECTION {
            owned.push(Box::new(MenuItem::with_id(
                app,
                more_id,
                format!("and {} more… in the queue", rows.len() - PER_SECTION),
                true,
                None::<&str>,
            )?));
        }
    }
    owned.push(Box::new(PredefinedMenuItem::separator(app)?));

    // Quick open: the last five sessions and rooms by name, then Inbox, Approvals queue, New session…
    let mut quick: Vec<Box<dyn IsMenuItem<tauri::Wry>>> = Vec::new();
    for (i, r) in inbox.recents.iter().take(RECENTS).enumerate() {
        let text = if r.kind == "room" { format!("#{}", r.title) } else { r.title.clone() };
        quick.push(Box::new(MenuItem::with_id(app, format!("recent:{i}"), text, true, None::<&str>)?));
    }
    if !inbox.recents.is_empty() {
        quick.push(Box::new(PredefinedMenuItem::separator(app)?));
    }
    let unread = inbox.items.len();
    quick.push(Box::new(MenuItem::with_id(
        app,
        "inbox",
        if unread > 0 { format!("Inbox · {unread}") } else { "Inbox".to_string() },
        true,
        None::<&str>,
    )?));
    quick.push(Box::new(MenuItem::with_id(app, "approvals", "Approvals queue", true, None::<&str>)?));
    quick.push(Box::new(MenuItem::with_id(app, "new", "New session…", true, None::<&str>)?));
    let quick_refs: Vec<&dyn IsMenuItem<tauri::Wry>> = quick.iter().map(|b| b.as_ref()).collect();
    owned.push(Box::new(Submenu::with_id_and_items(app, "quick", "Quick open", true, &quick_refs)?));

    // Pause notifications: approvals still badge; the icon dims with a moon.
    let mut pause: Vec<Box<dyn IsMenuItem<tauri::Wry>>> = Vec::new();
    if paused {
        pause.push(Box::new(MenuItem::with_id(app, "resume", "Resume now", true, None::<&str>)?));
    } else {
        pause.push(Box::new(MenuItem::with_id(app, "pause:hour", "For an hour", true, None::<&str>)?));
        pause.push(Box::new(MenuItem::with_id(app, "pause:tomorrow", "Until tomorrow", true, None::<&str>)?));
        pause.push(Box::new(MenuItem::with_id(app, "pause:say", "Until you say", true, None::<&str>)?));
    }
    let pause_refs: Vec<&dyn IsMenuItem<tauri::Wry>> = pause.iter().map(|b| b.as_ref()).collect();
    owned.push(Box::new(Submenu::with_id_and_items(
        app,
        "pause",
        if paused { "Resume notifications" } else { "Pause notifications" },
        true,
        &pause_refs,
    )?));
    owned.push(Box::new(PredefinedMenuItem::separator(app)?));
    owned.push(Box::new(MenuItem::with_id(app, "open", "Open Henosis", true, Some(OPEN_SHORTCUT))?));
    owned.push(Box::new(MenuItem::with_id(app, "quit", "Quit Henosis", true, None::<&str>)?));

    let refs: Vec<&dyn IsMenuItem<tauri::Wry>> = owned.iter().map(|b| b.as_ref()).collect();
    Menu::with_items(app, &refs)
}

/// Tray menu, tray icon (a dot when something awaits you, a moon while paused), tooltip and the
/// Dock/launcher badge, from the inbox as it is.
fn apply_tray(app: &AppHandle) {
    let shell = app.state::<Shell>();
    let (menu, total, paused) = {
        let mut g = lock(&shell.inbox);
        let menu = build_menu(app, &mut g);
        (menu, g.badge(), g.paused())
    };
    if let Some(tray) = app.tray_by_id("main") {
        if let Ok(menu) = menu {
            let _ = tray.set_menu(Some(menu));
        }
        let _ = tray.set_icon(Some(tray_icon(total > 0, paused)));
        #[cfg(target_os = "macos")]
        let _ = tray.set_icon_as_template(true);
        let _ = tray.set_tooltip(Some(match (total, paused) {
            (0, false) => "Henosis".to_string(),
            (0, true) => "Henosis · notifications paused".to_string(),
            (n, false) => format!("Henosis · {n} awaiting you"),
            (n, true) => format!("Henosis · {n} awaiting you · notifications paused"),
        }));
    }
    #[cfg(not(target_os = "windows"))]
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.set_badge_count(if total > 0 { Some(total as i64) } else { None });
    }
}

/// A 22 px ring with its centre (the Henosis mark, monochrome), an apricot dot in the top-right
/// corner when `attention`, and a dimmed ring with a moon in the lower-left while `paused`.
/// Black with alpha on macOS, where the tray treats it as a template image; linen elsewhere,
/// for the dark trays of Windows and most Linux desktops. The OS keeps its own colours around it.
fn tray_icon(attention: bool, paused: bool) -> Image<'static> {
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
    let dim: f32 = if paused { 0.55 } else { 1.0 };
    let mut px = vec![0u8; S * S * 4];
    let cover = |d: f32, r: f32| -> f32 { (r + 0.5 - d).clamp(0.0, 1.0) };
    for y in 0..S {
        for x in 0..S {
            let fx = x as f32 + 0.5;
            let fy = y as f32 + 0.5;
            let (cx, cy) = (11.0, 11.0);
            let d = ((fx - cx).powi(2) + (fy - cy).powi(2)).sqrt();
            // the ring: radius 7.5, stroke 2.5; the centre: radius 2
            let ring = (cover(d, 8.75) - cover(d, 6.25)).max(0.0);
            let centre = cover(d, 2.0);
            let mut a = ring.max(centre) * dim;
            let mut colour = ink;
            if paused {
                // a moon in the lower-left corner: a disc with a bite out of it
                let md = ((fx - 5.5).powi(2) + (fy - 16.5).powi(2)).sqrt();
                let bite = ((fx - 7.0).powi(2) + (fy - 15.0).powi(2)).sqrt();
                let moon = (cover(md, 4.3) - cover(bite, 3.4)).max(0.0);
                let halo = cover(md, 5.6);
                a = a * (1.0 - halo) + moon;
            }
            if attention {
                // the dot in the top-right corner, cut out of whatever is behind it
                let dd = ((fx - 17.0).powi(2) + (fy - 5.0).powi(2)).sqrt();
                let halo = cover(dd, 4.6);
                let dot = cover(dd, 3.2);
                a *= 1.0 - halo;
                if dot > 0.0 {
                    colour = apricot;
                    a = a.max(dot);
                }
            }
            let o = (y * S + x) * 4;
            px[o] = colour[0];
            px[o + 1] = colour[1];
            px[o + 2] = colour[2];
            px[o + 3] = (a.clamp(0.0, 1.0) * 255.0).round() as u8;
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

/// Open the client on a hash route: the window comes forward and the route is handed over.
fn open_route(app: &AppHandle, route: &str) {
    focus_main(app);
    let _ = app.emit("deep-link", route.to_string());
}

/// henosis://p/<project>/s/<session> (or henosis://c/<org>/<group>, henosis://inbox) → the
/// client's hash route. `fold://` is the scheme's old name, still answered.
fn route_of(url: &tauri::Url) -> Option<String> {
    if url.scheme() != "henosis" && url.scheme() != "fold" {
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

/// Until the next local midnight: "Until tomorrow".
fn until_tomorrow() -> Instant {
    use chrono::{Duration as ChronoDuration, Local, NaiveTime};
    let now = Local::now();
    let next = (now.date_naive() + ChronoDuration::days(1))
        .and_time(NaiveTime::MIN)
        .and_local_timezone(Local)
        .single()
        .unwrap_or(now + ChronoDuration::hours(12));
    let secs = (next - now).num_seconds().max(60) as u64;
    Instant::now() + Duration::from_secs(secs)
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

fn on_menu(app: &AppHandle, id: &str) {
    let shell = app.state::<Shell>();
    if let Some(item_id) = id.strip_prefix("item:") {
        let route = {
            let g = lock(&shell.inbox);
            g.items.iter().find(|i| i.id == item_id).map(|i| {
                if i.route.is_empty() {
                    i.link
                        .parse::<tauri::Url>()
                        .ok()
                        .and_then(|u| route_of(&u))
                        .unwrap_or_else(|| "#/inbox".to_string())
                } else {
                    i.route.clone()
                }
            })
        };
        match route {
            Some(r) => open_route(app, &r),
            None => open_route(app, "#/inbox"),
        }
        return;
    }
    if let Some(i) = id.strip_prefix("recent:") {
        let route = i
            .parse::<usize>()
            .ok()
            .and_then(|i| lock(&shell.inbox).recents.get(i).map(|r| r.route.clone()));
        if let Some(r) = route {
            open_route(app, &r);
        }
        return;
    }
    match id {
        "more:approvals" | "approvals" => {
            focus_main(app);
            let _ = app.emit("tray", "approvals");
        }
        "more:handoffs" | "more:mentions" | "inbox" => {
            focus_main(app);
            let _ = app.emit("tray", "inbox");
        }
        "new" => {
            focus_main(app);
            let _ = app.emit("tray", "new");
        }
        "pause:hour" => set_pause(app, Pause::Until(Instant::now() + Duration::from_secs(3600))),
        "pause:tomorrow" => set_pause(app, Pause::Until(until_tomorrow())),
        "pause:say" => set_pause(app, Pause::UntilSaid),
        "resume" => set_pause(app, Pause::Off),
        "open" => {
            focus_main(app);
            let _ = app.emit("tray", "open");
        }
        "quit" => app.exit(0),
        _ => {}
    }
}

fn set_pause(app: &AppHandle, pause: Pause) {
    lock(&app.state::<Shell>().inbox).pause = pause;
    apply_tray(app);
    emit_inbox(app);
}

fn main() {
    tauri::Builder::default()
        // First, so a second launch (a henosis:// link on Windows or Linux) reaches this instance.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| focus_main(app)))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        // ⌥⇧H / Ctrl+Shift+H from anywhere brings Henosis forward.
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        focus_main(app);
                    }
                })
                .build(),
        )
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
            set_recents,
            notify,
            win_minimize,
            win_toggle_maximize,
            win_close
        ])
        .on_window_event(|window, event| match event {
            WindowEvent::Focused(true) => {
                tauri::async_runtime::spawn(poll(window.app_handle().clone()));
            }
            // The window closes into the tray (macOS) or hides to the tray (Windows); Quit is in
            // the tray menu. Linux keeps the window manager's close.
            #[cfg(any(target_os = "macos", windows))]
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
            // be attached as an initialization script here. 1280×840 (desktop-window); the
            // platform's chrome is set here because the config cannot differ per platform.
            let cfg = app
                .config()
                .app
                .windows
                .iter()
                .find(|w| w.label == "main")
                .cloned()
                .ok_or("tauri.conf.json has no window labelled main")?;
            let builder = WebviewWindowBuilder::from_config(app, &cfg)?.initialization_script(BRIDGE_JS);
            // macOS: the titlebar is an overlay, so the navy rail runs from the very top edge with
            // the traffic lights hiddenInset in it; the client's title row is the drag region.
            #[cfg(target_os = "macos")]
            let builder = builder
                .title_bar_style(tauri::TitleBarStyle::Overlay)
                .hidden_title(true);
            // Windows: no decorations; the client draws the 36 px --rail titlebar with the mark,
            // "Henosis" and the caption buttons (apps/web/src/App.tsx).
            #[cfg(windows)]
            let builder = builder.decorations(false);
            builder.build()?;

            // The tray: the menu is rebuilt from the inbox after every poll (apply_tray).
            let menu = {
                let shell = app.state::<Shell>();
                let mut g = lock(&shell.inbox);
                build_menu(&handle, &mut g)?
            };
            TrayIconBuilder::with_id("main")
                .icon(tray_icon(false, false))
                .icon_as_template(true)
                .tooltip("Henosis")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| on_menu(app, event.id().as_ref()))
                .build(app)?;

            // Open Henosis from anywhere. A shortcut another app holds is left to it.
            {
                use tauri_plugin_global_shortcut::GlobalShortcutExt;
                let _ = app.global_shortcut().register(OPEN_SHORTCUT);
            }

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
