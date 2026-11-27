export type Doc = { id: string; title: string; text: string };
export type Chunk = { docId: string; title: string; text: string };
export type Hit = Chunk & { score: number };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const STOP = new Set("el la los las un una de del y o a en que por para con es se mi tu su al lo como hay son the and of to in for is".split(" "));
export const tokens = (s: string) => norm(s).split(/[^a-z0-9$]+/).filter((t) => t.length > 1 && !STOP.has(t));

export function chunk(docs: Doc[], max = 600): Chunk[] {
  return docs.flatMap((d) => {
    const out: Chunk[] = []; let cur = "";
    for (const p of d.text.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean)) {
      if (cur && cur.length + p.length > max) { out.push({ docId: d.id, title: d.title, text: cur }); cur = ""; }
      cur += (cur ? "\n\n" : "") + p;
    }
    if (cur) out.push({ docId: d.id, title: d.title, text: cur });
    return out;
  });
}

/** Recuperación léxica tipo BM25 simplificado. Devuelve [] si nada coincide (señal para transferir a humano). */
export function search(chunks: Chunk[], query: string, k = 4): Hit[] {
  const q = [...new Set(tokens(query))]; if (!q.length) return [];
  const docs = chunks.map((c) => tokens(c.title + " " + c.text));
  const avg = docs.reduce((a, d) => a + d.length, 0) / (docs.length || 1) || 1;
  const df = new Map<string, number>(); for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  return chunks.map((c, i) => {
    const d = docs[i]; let s = 0;
    for (const t of q) { const f = d.filter((x) => x === t).length; if (!f) continue; const idf = Math.log(1 + (chunks.length - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5)); s += idf * ((f * 2.2) / (f + 1.2 * (0.25 + 0.75 * d.length / avg))); }
    return { ...c, score: s };
  }).filter((h) => h.score > 0).sort((a, b) => b.score - a.score).slice(0, k);
}
