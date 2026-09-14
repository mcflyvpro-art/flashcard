//! Fine passerelle vers le crate officiel `fsrs` 6.6.2 — celui qu'Anki
//! embarque. Aucune formule n'est réécrite ici : ce fichier ne fait que
//! traduire des tableaux plats venus de JavaScript en `FSRSItem`, appeler
//! `fsrs::compute_parameters`, et rendre le tableau de paramètres.

use fsrs::{compute_parameters, ComputeParametersInput, FSRSItem, FSRSReview};

/// Réserve `n` mots de 32 bits. On alloue en `u32` et non en octets pour
/// que le pointeur soit aligné sur 4 : JavaScript ne sait poser un
/// `Uint32Array` sur la mémoire du module qu'à un décalage multiple de 4.
#[no_mangle]
pub extern "C" fn folio_alloc(n: usize) -> *mut u32 {
    let mut v: Vec<u32> = Vec::with_capacity(n.max(1));
    let p = v.as_mut_ptr();
    std::mem::forget(v);
    p
}

#[no_mangle]
pub unsafe extern "C" fn folio_free(p: *mut u32, n: usize) {
    if !p.is_null() && n > 0 {
        drop(Vec::from_raw_parts(p, 0, n));
    }
}

/// `ratings` et `delta_ts` sont les revues de toutes les fiches mises bout à
/// bout ; `lengths[i]` dit combien de revues appartiennent à la fiche i.
/// Même convention que `computeParameters` en amont.
#[no_mangle]
pub unsafe extern "C" fn folio_optimize(
    ratings: *const u32,
    delta_ts: *const u32,
    lengths: *const u32,
    n_items: usize,
    enable_short_term: u32,
    num_relearning_steps: u32,
    out_len: *mut usize,
) -> *mut f32 {
    *out_len = 0;
    let lens = std::slice::from_raw_parts(lengths, n_items);
    let total: usize = lens.iter().map(|x| *x as usize).sum();
    let rat = std::slice::from_raw_parts(ratings, total);
    let dts = std::slice::from_raw_parts(delta_ts, total);

    let mut train_set: Vec<FSRSItem> = Vec::with_capacity(n_items);
    let mut off = 0usize;
    for l in lens {
        let l = *l as usize;
        let reviews = (0..l)
            .map(|k| FSRSReview { rating: rat[off + k], delta_t: dts[off + k] })
            .collect::<Vec<_>>();
        train_set.push(FSRSItem { reviews });
        off += l;
    }

    let input = ComputeParametersInput {
        train_set,
        enable_short_term: enable_short_term != 0,
        num_relearning_steps: if num_relearning_steps == u32::MAX {
            None
        } else {
            Some(num_relearning_steps as usize)
        },
        ..ComputeParametersInput::default()
    };

    match compute_parameters(input) {
        Ok(w) => {
            let mut w = w;
            w.shrink_to_fit();
            *out_len = w.len();
            let p = w.as_mut_ptr();
            std::mem::forget(w);
            p
        }
        Err(_) => std::ptr::null_mut(),
    }
}

/// Les paramètres par défaut du crate, pour que le JS n'ait pas à les recopier.
#[no_mangle]
pub unsafe extern "C" fn folio_defaults(out_len: *mut usize) -> *mut f32 {
    let mut w = fsrs::DEFAULT_PARAMETERS.to_vec();
    w.shrink_to_fit();
    *out_len = w.len();
    let p = w.as_mut_ptr();
    std::mem::forget(w);
    p
}

/* `getrandom` n'a pas de source d'entropie sur wasm32-unknown-unknown. Le
   crate officiel ne s'en sert que pour des tirages déjà graines
   explicitement (mélange des lots, `StdRng::seed_from_u64`), donc ce
   crochet n'est en pratique jamais appelé. On le remplit quand même, de
   façon déterministe : même historique, mêmes paramètres — c'est aussi ce
   que fait la graine fixe d'Anki. */
static mut SEED: u64 = 0x9E3779B97F4A7C15;

#[no_mangle]
unsafe extern "Rust" fn __getrandom_v03_custom(
    dest: *mut u8,
    len: usize,
) -> Result<(), getrandom::Error> {
    let mut i = 0usize;
    while i < len {
        SEED = SEED.wrapping_add(0x9E3779B97F4A7C15);
        let mut z = SEED;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D049BB133111EB);
        z ^= z >> 31;
        let b = z.to_le_bytes();
        let n = core::cmp::min(8, len - i);
        core::ptr::copy_nonoverlapping(b.as_ptr(), dest.add(i), n);
        i += n;
    }
    Ok(())
}
