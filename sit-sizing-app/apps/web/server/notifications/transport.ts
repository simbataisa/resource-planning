import nodemailer from 'nodemailer';
import type { SendMail } from './dispatcher';

/**
 * SMTP sender for the notification worker (N-01). The URL carries host, port, TLS and
 * credentials (smtp://mail:1025 for the local mail catcher; smtps://… from the secret
 * store elsewhere). Connections are pooled and time out rather than hang the worker.
 */
export function smtpSender(url: string, from: string): SendMail {
  const transport = nodemailer.createTransport({
    url,
    pool: true,
    maxConnections: 2,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return async (mail) => {
    await transport.sendMail({
      from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      headers: { 'Auto-Submitted': 'auto-generated' },
    });
  };
}
