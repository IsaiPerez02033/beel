import { NextRequest, NextResponse } from "next/server";

const REPORT_EMAIL = "mexicobeel@gmail.com";
const SG_KEY = process.env.EMAIL_API_KEY ?? "";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      type,
      description,
      reporterEmail,
      reporterName,
      targetUrl,
      targetTitle,
      targetType, // "property" | "user" | "app" | "general"
    } = body;

    if (!description?.trim()) {
      return NextResponse.json({ error: "Descripción requerida" }, { status: 400 });
    }

    if (!SG_KEY) {
      // Sin email configurado — al menos loguear
      console.warn("REPORTE RECIBIDO (sin email):", body);
      return NextResponse.json({ ok: true });
    }

    const subject = `[Reporte Beel] ${type ?? "General"} — ${targetTitle ?? targetUrl ?? "Sin título"}`;

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Reporte</title></head>
<body style="margin:0;padding:0;background:#F1EFE8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1EFE8;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <tr><td style="padding-bottom:16px;text-align:center;">
          <span style="font-size:26px;font-weight:600;color:#147A5C;">beel</span>
          <p style="margin:4px 0 0;font-size:13px;color:#9C9A96;">Sistema de reportes</p>
        </td></tr>

        <tr><td style="background:#fff;border-radius:16px;padding:32px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">

          <div style="background:#FEF3CD;border-radius:10px;padding:12px 16px;margin-bottom:24px;">
            <p style="margin:0;font-size:13px;font-weight:600;color:#92610A;">🚨 Nuevo reporte recibido</p>
          </div>

          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr><td style="padding:8px 0;border-bottom:1px solid #EBEBEB;width:140px;font-size:13px;color:#9C9A96;">Tipo</td>
                <td style="padding:8px 0;border-bottom:1px solid #EBEBEB;font-size:14px;font-weight:600;color:#2C2C2A;">${type ?? "Sin especificar"}</td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #EBEBEB;font-size:13px;color:#9C9A96;">Categoría</td>
                <td style="padding:8px 0;border-bottom:1px solid #EBEBEB;font-size:14px;color:#2C2C2A;">${targetType ?? "general"}</td></tr>
            ${targetTitle ? `<tr><td style="padding:8px 0;border-bottom:1px solid #EBEBEB;font-size:13px;color:#9C9A96;">Relacionado con</td>
                <td style="padding:8px 0;border-bottom:1px solid #EBEBEB;font-size:14px;color:#2C2C2A;">${targetTitle}</td></tr>` : ""}
            ${targetUrl ? `<tr><td style="padding:8px 0;border-bottom:1px solid #EBEBEB;font-size:13px;color:#9C9A96;">URL</td>
                <td style="padding:8px 0;border-bottom:1px solid #EBEBEB;font-size:14px;color:#147A5C;"><a href="${targetUrl}" style="color:#147A5C;">${targetUrl}</a></td></tr>` : ""}
            <tr><td style="padding:8px 0;border-bottom:1px solid #EBEBEB;font-size:13px;color:#9C9A96;">Reportado por</td>
                <td style="padding:8px 0;border-bottom:1px solid #EBEBEB;font-size:14px;color:#2C2C2A;">${reporterName ?? "Anónimo"}${reporterEmail ? ` (${reporterEmail})` : ""}</td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #EBEBEB;font-size:13px;color:#9C9A96;">Fecha</td>
                <td style="padding:8px 0;border-bottom:1px solid #EBEBEB;font-size:14px;color:#2C2C2A;">${new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" })} (hora CDMX)</td></tr>
          </table>

          <div style="margin-top:24px;">
            <p style="margin:0 0 8px;font-size:13px;color:#9C9A96;font-weight:600;">DESCRIPCIÓN</p>
            <div style="background:#F8F7F4;border-radius:10px;padding:16px;font-size:14px;color:#2C2C2A;line-height:1.6;white-space:pre-wrap;">${description.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
          </div>

        </td></tr>

        <tr><td style="padding:16px 0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9C9A96;">Beel · Sistema automático de reportes</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    // Enviar via SendGrid
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SG_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: REPORT_EMAIL, name: "Beel Admin" }] }],
        from: { email: "mexicobeel@gmail.com", name: "Beel Reportes" },
        reply_to: reporterEmail ? { email: reporterEmail, name: reporterName ?? "" } : undefined,
        subject,
        content: [{ type: "text/html", value: html }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("SendGrid error en reporte:", err);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Error en /api/report:", e);
    return NextResponse.json({ error: "Error al enviar el reporte" }, { status: 500 });
  }
}
