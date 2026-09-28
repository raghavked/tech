use anyhow::Result;
use clap::{Args, Subcommand};

use super::Ctx;

#[derive(Args, Debug)]
pub struct StoreArgs {
    #[command(subcommand)]
    pub cmd: StoreCmd,
}

#[derive(Subcommand, Debug)]
pub enum StoreCmd {
    /// List datasets, parts, rows and date ranges.
    Ls,
    /// Re-hash every part and report corruption.
    Verify,
}

pub fn run(ctx: &Ctx, a: &StoreArgs) -> Result<()> {
    match a.cmd {
        StoreCmd::Ls => {
            let m = ctx.store.manifest()?;
            let mut rows = Vec::new();
            for (name, ds) in &m.datasets {
                for p in &ds.parts {
                    rows.push(vec![
                        name.clone(),
                        p.file.clone(),
                        p.source.clone(),
                        p.rows.to_string(),
                        p.min_date.clone().unwrap_or_default(),
                        p.max_date.clone().unwrap_or_default(),
                    ]);
                }
            }
            println!("store: {}", ctx.store.root().display());
            print!(
                "{}",
                super::table(&["dataset", "part", "source", "rows", "min", "max"], &rows)
            );
            let derived = std::fs::read_dir(ctx.store.root().join("derived"))
                .map(|d| {
                    d.filter_map(|e| e.ok())
                        .map(|e| e.file_name().to_string_lossy().to_string())
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            if !derived.is_empty() {
                let mut d = derived;
                d.sort();
                println!("derived: {}", d.join(", "));
            }
            Ok(())
        }
        StoreCmd::Verify => {
            let res = ctx.store.verify()?;
            let bad: Vec<_> = res.iter().filter(|r| !r.2).collect();
            for (ds, file, ok) in &res {
                println!("{:<8} {ds}/{file}", if *ok { "ok" } else { "CORRUPT" });
            }
            if bad.is_empty() {
                println!("{} parts verified", res.len());
                Ok(())
            } else {
                Err(basis_core::CoreError::Data(format!("{} corrupt parts", bad.len())).into())
            }
        }
    }
}
