# NFT Service API

This package combines a Stellar CLI-generated TypeScript contract client (`src/index.ts`) with the ZEXVRO NFT HTTP service. See the parent [`README.md`](../README.md) for architecture, routes, environment variables, and verification commands.

Regenerate the typed client after changing the Rust contract:

```bash
stellar contract build --manifest-path ../Cargo.toml
stellar contract bindings typescript \
  --wasm ../target/wasm32v1-none/release/zexvro_nft_collection.wasm \
  --output-dir /tmp/zexvro-nft-binding \
  --overwrite
```

Review the generated diff before replacing `src/index.ts`; service files in `src/` must not be overwritten.
