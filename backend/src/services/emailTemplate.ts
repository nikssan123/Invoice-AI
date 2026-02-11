import { config } from "../config.js";

type EmailTemplateOptions = {
  title: string;
  introText?: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  secondaryText?: string;
};

const BRAND_NAME = "Invoice Desk";

export function buildEmailHtml(options: EmailTemplateOptions): string {
  const baseUrl = (config.appUrl ?? "").replace(/\/$/, "");
  const logoUrl =
    config.emailLogoUrl?.trim() || (baseUrl ? `${baseUrl}/InvoiceLogo.png` : "");
  const showLogo = Boolean(logoUrl && (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")));
  const { title, introText, bodyHtml, ctaLabel, ctaUrl, secondaryText } = options;

  const logoImgHtml = showLogo
    ? `<img src="${logoUrl}" alt="${BRAND_NAME}" width="40" height="40" style="border-radius:8px; display:inline-block; vertical-align:middle; object-fit:contain;" />`
    : "";
  const brandNameMargin = showLogo ? " margin-left:8px;" : "";
  const headerBrandHtml = `${logoImgHtml}<span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:18px; font-weight:700; color:#111827;${brandNameMargin}">${BRAND_NAME}</span>`;

  const buttonHtml =
    ctaLabel && ctaUrl
      ? `<tr>
           <td align="center" style="padding: 24px 0 8px;">
             <a href="${ctaUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 999px; font-weight: 600; font-size: 15px;">
               ${ctaLabel}
             </a>
           </td>
         </tr>`
      : "";

  const secondaryHtml = secondaryText
    ? `<tr>
         <td style="padding-top: 16px; font-size: 13px; color: #6b7280; line-height: 1.5;">
           ${secondaryText}
         </td>
       </tr>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${BRAND_NAME}</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f3f4f6;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f3f4f6; padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px; background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 25px rgba(15,23,42,0.08);">
            <tr>
              <td style="padding:20px 24px 0 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="display:flex; align-items:center;">
                      ${headerBrandHtml}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px 24px 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-bottom:12px;">
                      <h1 style="margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:22px; font-weight:700; color:#111827;">
                        ${title}
                      </h1>
                    </td>
                  </tr>
                  ${
                    introText
                      ? `<tr>
                           <td style="padding-bottom:8px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:14px; color:#4b5563;">
                             ${introText}
                           </td>
                         </tr>`
                      : ""
                  }
                  <tr>
                    <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:14px; color:#374151; line-height:1.6;">
                      ${bodyHtml}
                    </td>
                  </tr>
                  ${buttonHtml}
                  ${secondaryHtml}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px 20px 24px; border-top:1px solid #e5e7eb;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:12px; color:#9ca3af; line-height:1.5; text-align:center;">
                      You're receiving this email because you use ${BRAND_NAME}.<br />
                      &copy; ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

