/**
 * LRU in-memory simples (fallback para Redis offline).
 *
 * Determinístico, sem dependências, com TTL por entrada.
 * Usado pelo retrieval cache quando Redis está indisponível — assim,
 * desenvolvimento local + Vercel preview ainda têm "cache" útil sem cluster.
 *
 * Não é multi-processo (cada lambda/instância tem o seu). Em produção,
 * Redis Cloud continua sendo o caminho oficial.
 */

type Entry<V> = {
  value: V;
  expiresAt: number;
};

export class MemoryLRU<V> {
  private readonly map = new Map<string, Entry<V>>();

  constructor(private readonly maxEntries: number = 256) {}

  get(key: string): V | null {
    const e = this.map.get(key);
    if (!e) return null;
    if (e.expiresAt < Date.now()) {
      this.map.delete(key);
      return null;
    }
    // Toca a entrada (move pro fim) para LRU.
    this.map.delete(key);
    this.map.set(key, e);
    return e.value;
  }

  set(key: string, value: V, ttlSeconds: number): void {
    if (this.map.size >= this.maxEntries) {
      // Remove o mais antigo (primeiro do iterator).
      const first = this.map.keys().next();
      if (!first.done) this.map.delete(first.value);
    }
    this.map.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1_000,
    });
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}
