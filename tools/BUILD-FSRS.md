# Comment `fsrs.wasm` est fabriqué

`fsrs.wasm` n'est pas du code écrit à la main : c'est le crate officiel
[`fsrs`](https://crates.io/crates/fsrs) **6.6.2** — la version exacte
qu'Anki épingle dans son `Cargo.toml` — compilé pour le navigateur.

Le seul fichier Rust de ce dépôt est `tools/fsrs-wasm-lib.rs` : une
passerelle qui traduit des tableaux plats venus de JavaScript en
`FSRSItem`, appelle `fsrs::compute_parameters`, et rend le tableau de
paramètres. Aucune formule n'y est réécrite.

## Refaire le binaire

```sh
mkdir fsrs-build && cd fsrs-build
cargo init --name folio_fsrs --lib
cp ../tools/fsrs-wasm-lib.rs src/lib.rs
cargo add fsrs@6.6.2 getrandom@0.4
rustup target add wasm32-unknown-unknown
```

`Cargo.toml` :

```toml
[lib]
crate-type = ["cdylib"]

[profile.release]
opt-level = 3
lto = true
codegen-units = 1
panic = "abort"
strip = true
```

Puis :

```sh
RUSTFLAGS='--cfg getrandom_backend="custom"' \
  cargo build --release --target wasm32-unknown-unknown
cp target/wasm32-unknown-unknown/release/folio_fsrs.wasm ../fsrs.wasm
```

`getrandom` n'a pas de source d'entropie sur `wasm32-unknown-unknown` ; le
crochet `custom` défini en bas de `lib.rs` la remplace par une suite
déterministe. Le crate officiel ne tire au sort qu'à partir de graines
explicites (mélange des lots), donc ce crochet n'est en pratique jamais
appelé, et l'optimiseur reste reproductible — même historique, mêmes
paramètres.

## Ce qu'on obtient

184 Ko, **aucun import** et une mémoire privée : le module s'instancie avec
un simple `WebAssembly.instantiate`, sans code de liaison, sans
`SharedArrayBuffer`, donc sans les en-têtes COOP/COEP que GitHub Pages ne
sait pas poser.

## Vérification

Le binaire wasm et une compilation native du même crate rendent des
paramètres identiques au millionième près sur les mêmes données. Et sur un
historique fabriqué avec des paramètres connus, l'optimiseur les retrouve.
La suite `opt.mjs` rejoue ces deux contrôles.
