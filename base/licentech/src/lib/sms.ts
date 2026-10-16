export async function sendSms(to: string, body: string) {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM: from } = process.env;
  if (!sid || !token || !from) {
    if (process.env.NODE_ENV === "production") throw new Error("SMS no configurado");
    console.log(`[SMS simulado] ${to}: ${body}`);
    return;
  }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}`);
}
