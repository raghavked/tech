.PHONY: ci fmt clippy test py e2e demo build

build:
	cargo build --workspace

fmt:
	cargo fmt --all --check

clippy:
	cargo clippy --workspace --all-targets --all-features -- -D warnings

test:
	cargo test --workspace --all-features

py:
	cd python && uv sync --all-extras --dev && uv run ruff check . && uv run ruff format --check . && uv run pytest -q

e2e:
	cargo build -p basis-cli --release
	BASIS_BIN=target/release/basis scripts/e2e.sh

demo:
	cargo run -q -p basis-cli -- --store ./store pipeline --synth-days 400

ci: fmt clippy test py e2e
