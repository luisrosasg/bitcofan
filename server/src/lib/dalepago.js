const API_URL    = process.env.DALEPAGO_API_URL    || 'https://dalepagolatam.com'
const KEY_ID     = process.env.DALEPAGO_API_KEY_ID
const KEY_SECRET = process.env.DALEPAGO_API_KEY_SECRET

export async function createPaymentLink({ amount, buyOrder, sessionId, returnUrl, email, description }) {
  const res = await fetch(`${API_URL}/api/v1/payment-links/webpay`, {
    method: 'POST',
    headers: {
      'Content-Type':     'application/json',
      'X-Api-Key-Id':     KEY_ID,
      'X-Api-Key-Secret': KEY_SECRET,
    },
    body: JSON.stringify({
      amount,
      buyOrder,
      sessionId,
      returnUrl,
      email,
      description,
      urlNotify: `${process.env.APP_URL}/api/payments/webhook`,
    }),
  })

  const data = await res.json()
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Error al crear el pago con DalePago')
  }
  return data.payment // { id, buyOrder, amount, token, payment_url }
}

export async function getPaymentStatus(paymentId) {
  const res = await fetch(`${API_URL}/api/v1/payment-links/${paymentId}`, {
    headers: {
      'X-Api-Key-Id':     KEY_ID,
      'X-Api-Key-Secret': KEY_SECRET,
    },
  })
  const data = await res.json()
  return data.payment ?? data
}
