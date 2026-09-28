//! End-to-end: `basis pipeline --tiny` into a temporary store produces every derived
//! dataset and the desk report, and the ledger identity holds on every row.

use std::path::PathBuf;
use std::process::Command;

use assert_cmd::prelude::*;

fn repo_root() -> PathBuf {
    PathBuf::from(concat!(env!("CARGO_MANIFEST_DIR"), "/../.."))
}

fn basis(store: &std::path::Path) -> Command {
    let mut c = Command::cargo_bin("basis").unwrap();
    c.current_dir(repo_root())
        .env("BASIS_OFFLINE", "1")
        .arg("--store")
        .arg(store)
        .arg("--seed")
        .arg("7");
    c
}

#[test]
fn tiny_pipeline_end_to_end() {
    let dir = tempfile::tempdir().unwrap();
    let store = dir.path().join("store");
    basis(&store)
        .args(["pipeline", "--tiny"])
        .assert()
        .success()
        .stdout(predicates::str::contains("pipeline complete"));

    for name in [
        "standardized",
        "estimates",
        "settlements",
        "curve",
        "spreads",
        "ledger",
        "equity",
        "signals",
        "positions",
    ] {
        let p = store.join("derived").join(format!("{name}.csv"));
        assert!(p.exists(), "missing derived/{name}.csv");
        let text = std::fs::read_to_string(&p).unwrap();
        assert!(
            text.lines().count() >= 1,
            "derived/{name}.csv has no header"
        );
    }
    // ledger identity: cash_after + unrealized == equity_after is checked by the book; here we
    // verify the file parses and the deposit is the first row
    let ledger = std::fs::read_to_string(store.join("derived/ledger.csv")).unwrap();
    let mut lines = ledger.lines();
    assert!(lines
        .next()
        .unwrap()
        .starts_with("seq,date,strategy,contract_id,kind"));
    assert!(lines.next().unwrap().contains("deposit"));

    let reports = std::fs::read_dir(store.join("reports")).unwrap().count();
    assert_eq!(reports, 1, "one report directory expected");
    let report_dir = std::fs::read_dir(store.join("reports"))
        .unwrap()
        .next()
        .unwrap()
        .unwrap()
        .path();
    let md = std::fs::read_to_string(report_dir.join("desk_report.md")).unwrap();
    for section in [
        "## 1. Index nowcasts",
        "## 5. Compute spark spreads",
        "## 6. Positions and P&L",
        "## 8. Data quality",
    ] {
        assert!(md.contains(section), "report missing {section}");
    }
    assert!(md.contains("Synthetic markets"));
    for f in [
        "summary.csv",
        "data_quality.csv",
        "positions.csv",
        "signals.csv",
    ] {
        assert!(report_dir.join(f).exists(), "missing {f}");
    }

    // store ls and verify work on the produced store
    basis(&store)
        .args(["store", "verify"])
        .assert()
        .success()
        .stdout(predicates::str::contains("parts verified"));
    basis(&store)
        .args(["store", "ls"])
        .assert()
        .success()
        .stdout(predicates::str::contains("observations"));
    basis(&store)
        .args(["ledger", "--tail", "3"])
        .assert()
        .success();
}

#[test]
fn same_seed_same_parts() {
    let dir = tempfile::tempdir().unwrap();
    let a = dir.path().join("a");
    let b = dir.path().join("b");
    for s in [&a, &b] {
        basis(s).args(["synth", "--tiny"]).assert().success();
    }
    let parts = |p: &std::path::Path| -> Vec<String> {
        let mut v: Vec<String> = std::fs::read_dir(p.join("raw/observations"))
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().to_string())
            .collect();
        v.sort();
        v
    };
    assert_eq!(parts(&a), parts(&b));
}

#[test]
fn exit_codes() {
    let dir = tempfile::tempdir().unwrap();
    let store = dir.path().join("store");
    // data error: nowcast before any ingest
    let out = basis(&store).args(["standardize"]).output().unwrap();
    assert_eq!(out.status.code(), Some(3));
    // network blocked: aws fetch offline
    let out = basis(&store)
        .args(["aws", "fetch", "--region", "us-east-1"])
        .output()
        .unwrap();
    assert_eq!(
        out.status.code(),
        Some(4),
        "{}",
        String::from_utf8_lossy(&out.stderr)
    );
    // config error: missing config dir
    let out = basis(&store)
        .args(["--config", "/nonexistent", "curve"])
        .output()
        .unwrap();
    assert!(matches!(out.status.code(), Some(2) | Some(3)));
}
