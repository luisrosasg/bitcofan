import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM   = process.env.EMAIL_FROM || 'noreply@bitcofan.com'
const APP_URL = process.env.APP_URL   || 'http://localhost:5173'

export async function sendVerificationEmail(to, username, token) {
  const link = `${APP_URL}/verify-email?token=${token}`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    body { background: #07021a; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrap { max-width: 520px; margin: 40px auto; background: #150732; border: 1.5px solid #4a1d8f; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #1d0a4a, #07021a); padding: 32px 40px; text-align: center; border-bottom: 1px solid #4a1d8f; }
    .logo { font-size: 28px; font-weight: 900; letter-spacing: 2px; }
    .logo .bitco { color: #e2e8f0; }
    .logo .fan   { color: #fcd34d; }
    .body { padding: 36px 40px; }
    h1 { color: #e9d5ff; font-size: 20px; margin: 0 0 12px; }
    p  { color: #a78bfa; font-size: 15px; line-height: 1.6; margin: 0 0 24px; }
    .btn {
      display: block; text-align: center;
      background: linear-gradient(135deg, #a855f7, #8b5cf6);
      color: #fff !important; text-decoration: none;
      font-size: 14px; font-weight: 700; letter-spacing: 1px;
      padding: 16px 32px; border-radius: 12px;
      box-shadow: 0 0 24px rgba(139,92,246,.4);
    }
    .footer { padding: 24px 40px; border-top: 1px solid #4a1d8f; text-align: center; }
    .footer p { color: #6d4aa8; font-size: 12px; margin: 0; }
    .link { color: #a855f7; word-break: break-all; font-size: 12px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="logo"><span class="bitco">BITCO</span><span class="fan">FAN</span></div>
    </div>
    <div class="body">
      <h1>¡Hola, ${username}! 🚀</h1>
      <p>Gracias por registrarte en BitcoFan. Solo falta verificar tu email para empezar a jugar y ganar premios.</p>
      <a href="${link}" class="btn">✓ VERIFICAR MI EMAIL</a>
      <p style="margin-top:24px;font-size:13px;">
        Si no creaste esta cuenta, puedes ignorar este mensaje.
      </p>
    </div>
    <div class="footer">
      <p>O copia este link en tu navegador:</p>
      <p><a href="${link}" class="link">${link}</a></p>
      <p style="margin-top:12px;">© 2026 BitcoFan · <a href="${APP_URL}" style="color:#6d4aa8;">bitcofan.com</a></p>
    </div>
  </div>
</body>
</html>`

  const { data, error } = await resend.emails.send({
    from:    FROM,
    to:      [to],
    subject: '✓ Verifica tu email — BitcoFan',
    html,
  })

  if (error) throw new Error(error.message)
  return data
}
