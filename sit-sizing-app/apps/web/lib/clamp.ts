/** Input normalisers that copy the prototype's input handlers exactly (bindNum setters). */
export const atLeast0 = (v: number) => Math.max(0, v);
export const atLeast0Int = (v: number) => Math.max(0, Math.round(v));
export const atLeast1Int = (v: number) => Math.max(1, Math.round(v));
export const percent = (v: number) => Math.min(100, Math.max(0, v));
