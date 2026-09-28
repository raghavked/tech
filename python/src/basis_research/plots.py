"""Optional matplotlib helpers (``pip install basis-research[plots]``)."""

from __future__ import annotations

from .store import Store


def _plt():
    try:
        import matplotlib.pyplot as plt
    except ImportError as e:  # pragma: no cover
        raise ImportError("install matplotlib: pip install basis-research[plots]") from e
    return plt


def plot_nowcast(store: Store, index_id: str):
    plt = _plt()
    est = store.estimates()
    est = est[est["index_id"] == index_id]
    prints = store.index_prints()
    prints = prints[prints["index_id"] == index_id]
    fig, ax = plt.subplots(figsize=(10, 4))
    ax.plot(est["date"], est["estimate"], label="nowcast")
    ax.fill_between(est["date"], est["ci_low"], est["ci_high"], alpha=0.2, label="90% CI")
    if not prints.empty:
        ax.plot(prints["date"], prints["value"], label="published print", linewidth=0.8)
    ax.set_title(f"{index_id} nowcast, $/GPU-hour")
    ax.legend()
    return fig


def plot_spreads(store: Store, kind: str):
    plt = _plt()
    sp = store.spreads()
    sp = sp[sp["kind"] == kind]
    fig, ax = plt.subplots(figsize=(10, 4))
    for sid, g in sp.groupby("spread_id"):
        ax.plot(g["date"], g["value"], label=sid, linewidth=0.8)
    ax.set_title(f"{kind} spreads, $/GPU-hour")
    ax.legend(fontsize=6)
    return fig


def plot_equity(store: Store):
    plt = _plt()
    eq = store.equity()
    fig, ax = plt.subplots(figsize=(10, 4))
    ax.plot(eq["date"], eq["equity"])
    ax.set_title("paper book equity")
    return fig
