-- Add html_template column to signature_team_config
ALTER TABLE public.signature_team_config ADD COLUMN IF NOT EXISTS html_template text;

-- Update the existing config row with the default template matching the new design
UPDATE public.signature_team_config
SET html_template = '<!-- HTML EMAIL SIGNATURE TEMPLATE -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="700" style="border-collapse:collapse; width:700px; font-family:''Helvetica Neue'',Helvetica,Arial,sans-serif; background-color:#ffffff;">
  <!-- TOP BANNER -->
  <tr>
    <td style="padding:0 0 16px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="700" style="border-collapse:collapse; width:700px;">
        <tr>
          <td bgcolor="#16232f" align="center" width="700" style="background-color:#16232f; width:700px; padding:10px 0; border-radius:4px;">
            <span style="font-family:''Helvetica Neue'',Helvetica,Arial,sans-serif; font-size:10px; line-height:13px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase; color:#ffffff;">
              {{accolade_line1}}
            </span>
            <span style="font-family:''Helvetica Neue'',Helvetica,Arial,sans-serif; font-size:10px; line-height:13px; font-weight:400; letter-spacing:1.2px; text-transform:uppercase; color:#8ba3ba;">
              &nbsp;&nbsp;&middot;&nbsp;&nbsp;{{accolade_line2}}
            </span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- MAIN AREA -->
  <tr>
    <td style="padding:0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="700" style="border-collapse:collapse; width:700px;">
        <tr>
          <!-- COLUMN 1: CIRCULAR PHOTO -->
          <td valign="middle" width="130" style="width:130px; padding:0 16px 0 0;">
            {{#if headshot_url}}
            <img src="{{headshot_url}}" alt="{{name}}" width="120" height="120" border="0" style="display:block; width:120px; height:120px; border-radius:50%; object-fit:cover; object-position:center top; border:1px solid #e2e8f0;" />
            {{else}}
            <div style="width:120px; height:120px; background-color:#f7fafc; border:1px dashed #cbd5e0; border-radius:50%; display:inline-block;"></div>
            {{/if}}
          </td>

          <!-- DIVIDER LINE -->
          <td width="1" bgcolor="#e2e8f0" style="width:1px; background-color:#e2e8f0;"></td>

          <!-- COLUMN 2: NAME, TITLE, LOGO -->
          <td valign="top" style="padding:0 20px 0 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:4px 0 2px 0;">
                  <span style="font-family:''Helvetica Neue'',Helvetica,Arial,sans-serif; font-size:24px; line-height:28px; font-weight:700; color:#16232f; letter-spacing:-0.5px;">
                    {{name}}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding:0 0 12px 0;">
                  <span style="font-family:''Helvetica Neue'',Helvetica,Arial,sans-serif; font-size:11px; line-height:14px; font-weight:700; color:#8ba3ba; text-transform:uppercase; letter-spacing:1px;">
                    {{title}}
                  </span>
                </td>
              </tr>
              <tr>
                <td>
                  {{#if logo_url}}
                  <a href="{{website_url}}" target="_blank" style="text-decoration:none; display:block;">
                    <img src="{{logo_url}}" alt="Matt Smith Real Estate Group" width="140" border="0" style="display:block; width:140px; height:auto;" />
                  </a>
                  {{/if}}
                </td>
              </tr>
            </table>
          </td>

          <!-- DIVIDER LINE -->
          <td width="1" bgcolor="#e2e8f0" style="width:1px; background-color:#e2e8f0;"></td>

          <!-- COLUMN 3: PHONES, SOCIALS, ADDRESSES, CTA -->
          <td valign="top" style="padding:0 0 0 20px; width:280px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <!-- Phones & Socials Header Row -->
              <tr>
                <td style="padding:4px 0 10px 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td style="font-family:''Helvetica Neue'',Helvetica,Arial,sans-serif; font-size:11px; line-height:16px; color:#16232f;">
                        {{#if mobile_phone}}
                        <span style="color:#C9A84C; font-weight:700; text-transform:uppercase; font-size:10px;">M</span>
                        <strong>{{mobile_phone}}</strong>
                        {{/if}}
                        {{#if office_phone}}
                        &nbsp;&nbsp;&nbsp;
                        <span style="color:#8ba3ba; font-weight:700; text-transform:uppercase; font-size:10px;">O</span>
                        <span style="color:#4a5568;">{{office_phone}}</span>
                        {{/if}}
                      </td>
                      <td align="right" style="padding:0;">
                        {{#if facebook_url}}
                        <a href="{{facebook_url}}" target="_blank" style="display:inline-block; margin-left:6px; text-decoration:none;">
                          <img src="{{icon_fb_url}}" alt="Facebook" width="18" height="18" border="0" style="display:block; width:18px; height:18px;" />
                        </a>
                        {{/if}}
                        {{#if instagram_url}}
                        <a href="{{instagram_url}}" target="_blank" style="display:inline-block; margin-left:6px; text-decoration:none;">
                          <img src="{{icon_ig_url}}" alt="Instagram" width="18" height="18" border="0" style="display:block; width:18px; height:18px;" />
                        </a>
                        {{/if}}
                        {{#if website_url}}
                        <a href="{{website_url}}" target="_blank" style="display:inline-block; margin-left:6px; text-decoration:none;">
                          <img src="{{icon_web_url}}" alt="Website" width="18" height="18" border="0" style="display:block; width:18px; height:18px;" />
                        </a>
                        {{/if}}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Office Addresses -->
              <tr>
                <td style="padding:0 0 12px 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      {{#if office1_addr}}
                      <td valign="top" style="padding:0 8px 0 0; width:50%;">
                        <div style="font-family:''Helvetica Neue'',Helvetica,Arial,sans-serif; font-size:10px; font-weight:700; color:#16232f; text-transform:uppercase; letter-spacing:0.5px;">{{office1_label}}</div>
                        <div style="font-family:''Helvetica Neue'',Helvetica,Arial,sans-serif; font-size:9px; line-height:12px; color:#718096; margin-top:2px;">{{office1_addr}}</div>
                      </td>
                      {{/if}}
                      {{#if office2_addr}}
                      <td valign="top" style="padding:0; width:50%;">
                        <div style="font-family:''Helvetica Neue'',Helvetica,Arial,sans-serif; font-size:10px; font-weight:700; color:#16232f; text-transform:uppercase; letter-spacing:0.5px;">{{office2_label}}</div>
                        <div style="font-family:''Helvetica Neue'',Helvetica,Arial,sans-serif; font-size:9px; line-height:12px; color:#718096; margin-top:2px;">{{office2_addr}}</div>
                      </td>
                      {{/if}}
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Call to Action Button -->
              {{#if valuation_url}}
              <tr>
                <td style="padding:2px 0 0 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td bgcolor="#1e70e6" style="background-color:#1e70e6; border-radius:4px; padding:8px 16px;" align="center">
                        <a href="{{valuation_url}}" target="_blank" style="font-family:''Helvetica Neue'',Helvetica,Arial,sans-serif; font-size:11px; font-weight:700; color:#ffffff; text-decoration:none; display:inline-block; text-transform:uppercase; letter-spacing:0.5px;">
                          Instant Home Valuation &rarr;
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              {{/if}}
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- BOTTOM BAR ACCENT -->
  <tr>
    <td style="padding:14px 0 0 0; border-top:2px solid #C9A84C; margin-top:10px;"></td>
  </tr>
</table>'
WHERE id IS NOT NULL;
