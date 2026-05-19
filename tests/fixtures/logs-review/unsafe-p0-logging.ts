/** Fixture — deve acionar P0 (não importar em produção). */

export function unsafeP0() {
  console.log("debug env", { SUPABASE_SERVICE_ROLE_KEY: process.env["X"] });
}
