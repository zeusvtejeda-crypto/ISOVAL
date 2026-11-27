import { createHmac, timingSafeEqual } from "node:crypto";

/** Verifica X-Hub-Signature-256 (HMAC-SHA256 del cuerpo crudo con el App Secret de Meta). */
export function verifySignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const exp = createHmac("sha256", appSecret).update(rawBody).digest();
  const got = Buffer.from(header.slice(7), "hex");
  return got.length === exp.length && timingSafeEqual(got, exp);
}

/** GET de verificación del webhook. Devuelve el challenge o null. */
export const verifyChallenge = (q: URLSearchParams, verifyToken: string) =>
  q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === verifyToken ? q.get("hub.challenge") : null;

export type Inbound = { phoneNumberId: string; from: string; name?: string; id: string; type: string; text?: string; timestamp: string };

type Msg = { from: string; id: string; timestamp: string; type: string; text?: { body: string } };
type Payload = { entry?: { changes?: { value?: { metadata?: { phone_number_id?: string }; contacts?: { wa_id: string; profile?: { name?: string } }[]; messages?: Msg[] } }[] }[] };

export function parseInbound(p: unknown): Inbound[] {
  const res: Inbound[] = [];
  for (const e of (p as Payload)?.entry ?? []) for (const c of e.changes ?? []) {
    const v = c.value; if (!v?.messages) continue;
    for (const m of v.messages) res.push({ phoneNumberId: v.metadata?.phone_number_id ?? "", from: m.from, id: m.id, type: m.type, text: m.text?.body, timestamp: m.timestamp, name: v.contacts?.find((x) => x.wa_id === m.from)?.profile?.name });
  }
  return res;
}

export async function sendText(o: { token: string; phoneNumberId: string; to: string; body: string }, f: typeof fetch = fetch) {
  const r = await f(`https://graph.facebook.com/v21.0/${o.phoneNumberId}/messages`, { method: "POST", headers: { authorization: `Bearer ${o.token}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: o.to, type: "text", text: { body: o.body } }) });
  if (!r.ok) throw new Error(`WhatsApp respondió ${r.status}`);
}
