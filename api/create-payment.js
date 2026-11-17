const AMOUNT = 300;
const CURRENCY = "980";

async function getToken() {
  const host = process.env.A_BANK_HOST;
  const login = process.env.A_BANK_LOGIN;
  const secretKey = process.env.A_BANK_SECRET_KEY;
  if (!host || !login || !secretKey) throw new Error("Missing A-Bank environment variables");
  const response = await fetch(`${host.replace(/\/$/, "")}/api/v1/internet-acquiring/auth/get-token`, {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ login, secret_key: secretKey })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error("A-Bank authorization failed");
  return data.access_token;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed" }); }
  try {
    const host = process.env.A_BANK_HOST.replace(/\/$/, "");
    const siteUrl = (process.env.SITE_URL || `https://${req.headers.host}`).replace(/\/$/, "");
    const token = await getToken();
    const orderId = `tita-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const response = await fetch(`${host}/api/v1/internet-acquiring/make-invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        amount: AMOUNT, description: "Оплата замовлення TITA shop",
        callback_url: `${siteUrl}/payment-return.html`,
        callback_system: `${siteUrl}/api/payment-callback`,
        items: [{ message: "Замовлення TITA shop", amount: AMOUNT, count: 1 }],
        order_id_system: orderId
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.invoice_url || !data.invoice_id) {
      console.error("A-Bank invoice error", { httpStatus: response.status, result: data.result, response_ref: data.response_ref });
      return res.status(502).json({ error: "А-Банк не зміг створити платіжний рахунок" });
    }
    let invoiceUrl;
    try { invoiceUrl = new URL(data.invoice_url); } catch { invoiceUrl = null; }
    if (!invoiceUrl || invoiceUrl.protocol !== "https:") {
      console.error("A-Bank returned an invalid invoice_url");
      return res.status(502).json({ error: "А-Банк повернув некоректне посилання на оплату" });
    }
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ invoice_id: String(data.invoice_id), invoice_url: invoiceUrl.toString(), amount: AMOUNT, currency: CURRENCY });
  } catch (error) {
    console.error("Create payment error:", error.message);
    return res.status(500).json({ error: "Не вдалося створити платіж. Перевірте налаштування інтеграції." });
  }
};
