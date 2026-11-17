module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).end("Method not allowed"); }
  // Callback є повідомленням; остаточний статус підтверджується окремим API-запитом.
  console.log("A-Bank callback received", { status: req.body?.status, resultCode: req.body?.resultCode, resultDesc: req.body?.resultDesc });
  return res.status(200).json({ received: true });
};
