# Magic Link Emails Not Reaching Outlook / Hotmail

**Gmail often works; Hotmail and Outlook.com frequently don’t** when using Supabase’s default email. Use the steps below so magic links reach Hotmail/Outlook reliably.

If magic link emails are not arriving in your Outlook or Hotmail account, work through these steps.

## 1. Use Custom SMTP in Supabase (Required for most addresses)

Supabase’s **default** email provider has strict limits:

- **Sends only to pre-authorized addresses** – Your Outlook/Hotmail address must be added in the Supabase org **Team** tab, or the email will not be sent (you may see “Email address not authorized” in Auth logs).
- **Very low rate limit** – About 2 emails per hour.
- **No delivery guarantee** – Messages can be dropped or filtered by recipient servers (e.g. Outlook).

**Fix:** Configure your own SMTP in Supabase so magic links are sent by a proper email service (better deliverability to Outlook).

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **Authentication** → **Providers** → **Email**, or **Project Settings** → **Auth** → **SMTP Settings**.
3. Enable **Custom SMTP** and enter your provider’s details:
   - **Host, port, user, password** (from SendGrid, Resend, etc.).
   - **Sender email** (e.g. `noreply@yourdomain.com`) and **Sender name** (e.g. “LunchMeet”).

Good options: [SendGrid](https://www.twilio.com/docs/sendgrid/for-developers/sending-email/getting-started-smtp), [Resend](https://resend.com/docs/send-with-supabase-smtp), [Brevo](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP), AWS SES, Postmark.

4. If using your own domain, set up **SPF, DKIM, and DMARC** with that provider so Outlook is more likely to accept the mail.

After saving, request a new magic link and check Outlook again.

## 2. Check Outlook: Junk, Spam, and Focused Inbox

- **Junk / Spam** – Open the **Junk Email** folder and search for “Supabase”, “magic link”, or your app name.
- **Focused vs Other** – If you use Focused Inbox, check the **Other** tab as well.
- **Search** – In Outlook (web or app), search for “Supabase” or “magic link” and include **All folders** or **Include Junk**.

## 3. Add Sender to Safe Senders (Outlook)

So future magic links are less likely to be filtered:

**Outlook on the web (outlook.com):**

1. **Settings** (gear) → **View all Outlook settings** → **Mail** → **Junk email**.
2. Under **Safe senders and domains**, add:
   - The “From” address Supabase uses (e.g. `noreply@yourdomain.com` or the address shown in Auth email templates).
   - If you’re still on default Supabase mail, you might see something like `...@supabase.io` – add that only for testing; long-term use custom SMTP and your own domain.

**Outlook desktop:**  
**Home** → **Junk** → **Junk E-mail Options** → **Safe Senders** → add the same address.

## 4. Verify Supabase Actually Sent the Email

1. In Supabase: **Authentication** → **Logs** (or **Auth logs**).
2. Request a magic link to your Outlook address and check for:
   - **Success** – “Magic link sent” or similar (means Supabase handed off to SMTP; delivery is then up to the provider and Outlook).
   - **Error** – e.g. “Email address not authorized”, SMTP errors, or rate limit. Fix those first (team membership or custom SMTP).

If the log shows success but Outlook still has nothing, the message is likely filtered (Junk/Other) or blocked by Microsoft; use Steps 2 and 3 and improve SMTP/domain (Step 1).

## 5. Corporate / Work Outlook

If this is a **work or school** Outlook (Microsoft 365):

- IT may block or quarantine external senders. Ask IT to allow your app’s sending domain or SMTP provider.
- As a workaround, use a **personal Outlook.com** (or Gmail) address for testing magic links.

## Why Gmail Works but Hotmail/Outlook Often Doesn’t

- **Gmail** tends to accept mail from Supabase’s default sender more often.
- **Hotmail / Outlook.com** filter or block the same messages more aggressively, so links often never reach Inbox or Junk unless you:
  1. **Use Custom SMTP** (recommended) so emails come from a real domain (e.g. SendGrid/Resend with your domain and SPF/DKIM).
  2. **Add the sender to Safe senders** in Outlook so future links aren’t filtered.

## Summary

| Step | Action |
|------|--------|
| 1 | Configure **Custom SMTP** in Supabase (SendGrid, Resend, etc.) and use a proper sender domain with SPF/DKIM. |
| 2 | Check **Junk**, **Spam**, and **Other** in Outlook/Hotmail. |
| 3 | Add the magic-link **sender address** to Outlook **Safe senders**. |
| 4 | Confirm in **Supabase Auth logs** that the magic link was sent successfully. |
| 5 | For work Outlook, involve IT or test with a personal email. |

Once custom SMTP is set and the sender is trusted in Outlook, magic link emails should start reaching your Hotmail/Outlook inbox reliably.
