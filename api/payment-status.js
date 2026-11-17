async function getToken() {
  const hostValue = process.env.A_BANK_HOST;
  const login = process.env.A_BANK_LOGIN;
  const secretKey = process.env.A_BANK_SECRET_KEY;
  if (!hostValue || !login || !secretKey) throw new Error("Missing A-Bank environment variables");
  const host = hostValue.replace(/\/$/, "");
  const response = await fetch(`${host}/api/v1/internet-acquiring/auth/get-token`, {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ login, secret_key: secretKey })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error("Authorization failed");
  return data.access_token;
}
module.exports = async function handler(req, res) {
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "Method not allowed" }); }
  const invoiceId = String(req.query.invoice_id || "");
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(invoiceId)) return res.status(400).json({ error: "Invalid invoice_id" });
  try {
    const token = await getToken();
    const host = process.env.A_BANK_HOST;
    if (!host) throw new Error("Missing A_BANK_HOST");
    const url = new URL(`${host.replace(/\/$/, "")}/api/v1/internet-acquiring/get-invoice-state`);
    url.searchParams.set("invoice_id", invoiceId);
    const response = await fetch(url, { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !["new", "paid", "cancel", "failed", "refund"].includes(data.status)) return res.status(502).json({ error: "Не вдалося перевірити статус платежу" });
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ status: data.status, amount: data.oper_data?.AMOUNT ?? null, currency: data.oper_data?.CURRENCY ?? null });
  } catch (error) {
    console.error("Payment status error:", error.message);
    return res.status(500).json({ error: "Помилка перевірки платежу" });
  }
};
