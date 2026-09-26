import nodemailer from 'nodemailer';

function createEmailTransporter() {
  let rawHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  rawHost = rawHost.replace(/^https?:\/\//i, '');
  const smtpHost = rawHost || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = (process.env.SMTP_USER || process.env.GMAIL_USER || 'suporte.dinheirosemfiltro@gmail.com').trim();
  const rawPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || 'trvi gvze szzm jibr';
  const smtpPass = rawPass ? rawPass.trim() : 'trvi gvze szzm jibr';
  const isGmail = smtpHost.includes('gmail.com') || smtpUser.endsWith('@gmail.com');

  if (isGmail) {
    return {
      transporter: nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      }),
      smtpUser,
      emailFrom: process.env.EMAIL_FROM || `Dinheiro Sem Filtro <${smtpUser}>`,
    };
  }

  return {
    transporter: nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    }),
    smtpUser,
    emailFrom: process.env.EMAIL_FROM || `Dinheiro Sem Filtro <${smtpUser}>`,
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { email, resetCode, userName } = req.body || {};

    if (!email) {
      return res.status(400).json({ success: false, message: 'E-mail é obrigatório.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const name = userName || cleanEmail.split('@')[0];
    const code = resetCode || Math.floor(100000 + Math.random() * 900000).toString();

    const { transporter, smtpUser, emailFrom } = createEmailTransporter();

    let emailSent = false;
    let sendError = '';

    if (smtpUser) {
      try {
        const mailOptions = {
          from: emailFrom,
          to: cleanEmail,
          subject: '🔒 [Dinheiro Sem Filtro] Código para Redefinição de Senha',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #E5E7EB; border-radius: 16px; background-color: #FFFFFF;">
              <div style="text-align: center; padding-bottom: 16px; border-bottom: 2px solid #D4AF37;">
                <h1 style="color: #121212; font-size: 22px; margin: 0;">Dinheiro Sem Filtro</h1>
                <p style="color: #00C853; font-weight: bold; font-size: 13px; margin-top: 4px;">Finanças Simples e Sem Segredos</p>
              </div>
              <div style="padding: 24px 0;">
                <p style="font-size: 15px; color: #121212;">Olá <strong>${name}</strong>,</p>
                <p style="font-size: 14px; color: #374151; line-height: 1.5;">
                  Recebemos uma solicitação de redefinição de senha para o seu e-mail (<strong>${cleanEmail}</strong>).
                </p>
                <div style="margin: 24px 0; text-align: center; background-color: #FFFBEB; border: 1px solid #FCD34D; border-radius: 12px; padding: 16px;">
                  <span style="font-size: 12px; font-weight: bold; color: #92400E; display: block; text-transform: uppercase; letter-spacing: 1px;">Seu Código de Segurança</span>
                  <span style="font-size: 32px; font-weight: 900; color: #121212; letter-spacing: 6px; font-family: monospace; display: block; margin-top: 8px;">${code}</span>
                </div>
                <p style="font-size: 13px; color: #6B7280;">
                  Copie e digite este código de 6 dígitos no aplicativo para cadastrar sua nova senha com segurança.
                </p>
                <p style="font-size: 12px; color: #9CA3AF; margin-top: 20px;">
                  Atenciosamente,<br />
                  <strong>Equipe Dinheiro Sem Filtro</strong><br />
                  <a href="mailto:suporte.dinheirosemfiltro@gmail.com" style="color: #2563EB;">suporte.dinheirosemfiltro@gmail.com</a>
                </p>
              </div>
            </div>
          `,
        };

        const info = await transporter.sendMail(mailOptions);
        emailSent = true;
        console.log(`[SMTP Success] E-mail enviado com sucesso para ${cleanEmail}. Message ID: ${info.messageId}`);
      } catch (err: any) {
        console.error('[SMTP Error]', err?.message || err);
        sendError = err?.message || 'Falha ao conectar ao servidor SMTP.';
      }
    }

    return res.status(200).json({
      success: true,
      emailSent,
      code,
      message: emailSent
        ? `✉️ E-mail de redefinição enviado com sucesso para ${cleanEmail}! Verifique sua caixa de entrada e spam.`
        : `✉️ Instruções processadas para ${cleanEmail}. Se o e-mail não chegar em alguns instantes, verifique sua caixa de spam ou use o código: ${code}`,
      ...(sendError ? { errorDetails: sendError } : {}),
    });
  } catch (error: any) {
    console.error('[API send-reset-email error]', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao processar e-mail de redefinição.',
      error: error?.message,
    });
  }
}
