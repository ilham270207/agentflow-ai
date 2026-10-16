import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

export const mailConfigured = Boolean(process.env.MAIL_USER && process.env.MAIL_APP_PASSWORD);

let transporter = null;
function getTransporter() {
  if (!mailConfigured) throw new Error("Email belum dikonfigurasi (MAIL_USER / MAIL_APP_PASSWORD).");
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.MAIL_USER,
        pass: String(process.env.MAIL_APP_PASSWORD).replace(/\s+/g, "")
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000
    });
  }
  return transporter;
}

export async function sendMail({ to, subject, text, html, attachments }) {
  const name = String(process.env.MAIL_FROM_NAME || "Umaira AI").replace(/["<>\r\n]/g, "");
  return getTransporter().sendMail({
    from: '"' + name + '" <' + process.env.MAIL_USER + ">",
    to, subject, text, html, attachments
  });
}

const LOGO_PATH = path.join(process.cwd(), "public", "assets", "umaira-logo-email.png");

const COPY = {
  reset: {
    subject: "Kode pengaturan ulang kata sandi Umaira AI",
    title: "Atur ulang kata sandi",
    intro: "Kami menerima permintaan untuk mengatur ulang kata sandi akun Umaira AI Anda. Masukkan kode verifikasi berikut pada halaman Umaira AI untuk melanjutkan.",
    ignore: "Jika Anda tidak merasa membuat permintaan ini, abaikan email ini. Kata sandi Anda tidak akan berubah."
  },
  ganti: {
    subject: "Kode verifikasi penggantian kata sandi Umaira AI",
    title: "Verifikasi penggantian kata sandi",
    intro: "Kami menerima permintaan penggantian kata sandi untuk akun Umaira AI Anda. Masukkan kode verifikasi berikut untuk menyelesaikannya.",
    ignore: "Jika Anda tidak merasa membuat permintaan ini, segera amankan akun Anda dengan mengganti kata sandi."
  },
  verifikasi: {
    subject: "Kode verifikasi Umaira AI",
    title: "Verifikasi akun Anda",
    intro: "Gunakan kode verifikasi berikut untuk melanjutkan proses di Umaira AI.",
    ignore: "Jika Anda tidak merasa membuat permintaan ini, abaikan email ini."
  }
};

export function otpEmail({ code, purpose, minutes }) {
  const c = COPY[purpose] || COPY.verifikasi;
  const year = new Date().getFullYear();
  const hasLogo = fs.existsSync(LOGO_PATH);
  const attachments = hasLogo
    ? [{ filename: "umaira-ai.png", path: LOGO_PATH, cid: "umaira-logo", contentDisposition: "inline" }]
    : [];
  const logoImg = hasLogo
    ? '<img src="cid:umaira-logo" width="56" height="56" alt="Umaira AI" style="display:block;margin:0 auto 10px;border:0;border-radius:14px">'
    : "";

  const text =
    c.title + "\n\n" +
    c.intro + "\n\n" +
    "Kode verifikasi: " + code + "\n" +
    "Berlaku " + minutes + " menit dan hanya dapat digunakan satu kali.\n\n" +
    "Demi keamanan akun Anda, jangan bagikan kode ini kepada siapa pun. Tim Umaira AI tidak akan pernah meminta kode verifikasi Anda.\n" +
    c.ignore + "\n\n" +
    "Email ini dikirim otomatis oleh sistem keamanan Umaira AI. Mohon tidak membalas email ini.\n" +
    "(c) " + year + " Umaira AI";

  const html =
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">Kode verifikasi Anda berlaku ' + minutes + ' menit. Jangan bagikan kode ini kepada siapa pun.' + '&nbsp;&zwnj;'.repeat(70) + '</div>' +
    '<div style="background:#f4f4f7;padding:28px 12px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif">' +
    '<div style="max-width:440px;margin:0 auto;background:#ffffff;border:1px solid #e7e7ee;border-radius:18px;overflow:hidden">' +
    '<div style="height:5px;background:#8b5cf6;background-image:linear-gradient(90deg,#6d5dfc,#b46cf5)"></div>' +
    '<div style="padding:30px 28px 26px">' +
    '<div style="text-align:center;margin-bottom:22px">' + logoImg +
    '<div style="font-size:15px;font-weight:700;letter-spacing:.08em;color:#1b1b26">UMAIRA AI</div></div>' +
    '<h1 style="margin:0 0 10px;font-size:20px;line-height:1.3;color:#14141c;text-align:center">' + c.title + '</h1>' +
    '<p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#4a4a58;text-align:center">' + c.intro + '</p>' +
    '<div style="text-align:center;font-size:34px;font-weight:700;letter-spacing:.32em;padding:16px 0 16px .32em;border-radius:14px;background:#f5f3ff;color:#2b2266;border:1px solid #e4defc">' + code + '</div>' +
    '<p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#5c5c6a;text-align:center">Kode berlaku <b>' + minutes + ' menit</b> dan hanya dapat digunakan satu kali.</p>' +
    '<hr style="border:0;border-top:1px solid #ececf2;margin:22px 0 16px">' +
    '<p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#6b6b78"><b>Demi keamanan akun Anda:</b> jangan bagikan kode ini kepada siapa pun. Tim Umaira AI tidak akan pernah meminta kode verifikasi Anda.</p>' +
    '<p style="margin:0;font-size:12px;line-height:1.6;color:#6b6b78">' + c.ignore + '</p>' +
    '</div>' +
    '<div style="background:#fafafc;border-top:1px solid #ececf2;padding:14px 28px;text-align:center;font-size:11px;line-height:1.6;color:#8a8a97">Email ini dikirim otomatis oleh sistem keamanan Umaira AI. Mohon tidak membalas email ini.<br>&copy; ' + year + ' Umaira AI</div>' +
    '</div></div>';

  return { subject: c.subject, text, html, attachments };
}
