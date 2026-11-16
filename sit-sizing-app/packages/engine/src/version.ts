/**
 * Engine version, stored with every saved result (design 6.6).
 * 1.0.0 = faithful port of the HTML prototype; golden parity is the contract.
 * 1.1.0 = data-test minutes and preparation hours by complexity (ADR-0019).
 * 1.2.0 = ten rough-scope feature sizes, XXS to XXXL (ADR-0020); no formula change.
 * 1.3.0 = feature sizes are data: a profile can add, rename and remove them (ADR-0021); no formula change.
 * Any change to a formula or default bumps at least the minor version, with an ADR.
 */
export const ENGINE_VERSION = '1.3.0';
