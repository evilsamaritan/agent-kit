# Email Patterns — Provider Setup & Templates

## Resend (Modern API)

### Setup and Send

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendTransactionalEmail(
  to: string,
  subject: string,
  reactComponent: React.ReactElement
) {
  const { data, error } = await resend.emails.send({
    from: 'App Name <noreply@transactional.example.com>',
    to,
    subject,
    react: reactComponent,
    headers: {
      'X-Entity-Ref-ID': generateIdempotencyKey(), // prevent threading
    },
  });

  if (error) throw new EmailSendError(error.message);
  return data;
}
```

### Batch Sending

```typescript
const { data } = await resend.batch.send([
  {
    from: 'App <noreply@example.com>',
    to: 'user1@example.com',
    subject: 'Welcome',
    react: WelcomeEmail({ name: 'Alice' }),
  },
  {
    from: 'App <noreply@example.com>',
    to: 'user2@example.com',
    subject: 'Welcome',
    react: WelcomeEmail({ name: 'Bob' }),
  },
]);
```

---

## AWS SES

### Setup

```typescript
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const ses = new SESv2Client({ region: 'us-east-1' });

async function sendEmail(to: string, subject: string, html: string, text: string) {
  await ses.send(new SendEmailCommand({
    FromEmailAddress: 'noreply@transactional.example.com',
    Destination: { ToAddresses: [to] },
    Content: {
      Simple: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: html, Charset: 'UTF-8' },
          Text: { Data: text, Charset: 'UTF-8' },
        },
      },
    },
  }));
}
```

### SES Configuration Checklist

1. Verify sending domain (not just email address)
2. Request production access (move out of sandbox)
3. Set up configuration set for tracking
4. Configure SNS topic for bounces and complaints
5. Set up DKIM (Easy DKIM or BYODKIM)

---

## React Email Templates

### Welcome Email

```tsx
import {
  Html, Head, Body, Container, Section, Text,
  Button, Img, Hr, Preview,
} from '@react-email/components';

interface WelcomeEmailProps {
  name: string;
  loginUrl: string;
}

export function WelcomeEmail({ name, loginUrl }: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to our platform, {name}!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img src="https://example.com/logo.png" width={120} height={40} alt="Logo" />
          <Section>
            <Text style={heading}>Welcome, {name}!</Text>
            <Text style={paragraph}>
              Your account is ready. Click below to get started.
            </Text>
            <Button style={button} href={loginUrl}>
              Get Started
            </Button>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>
            Example Inc, 123 Main St, City, ST 12345
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: '#f6f9fc', fontFamily: 'sans-serif' };
const container = { margin: '0 auto', padding: '40px 20px', maxWidth: '560px' };
const heading = { fontSize: '24px', fontWeight: 'bold', color: '#1a1a1a' };
const paragraph = { fontSize: '16px', lineHeight: '26px', color: '#4a4a4a' };
const button = {
  backgroundColor: '#0066ff', color: '#fff', padding: '12px 24px',
  borderRadius: '6px', fontSize: '16px', textDecoration: 'none',
};
const hr = { borderColor: '#e6e6e6', margin: '32px 0' };
const footer = { fontSize: '12px', color: '#8c8c8c' };
```

### Password Reset Email

```tsx
export function PasswordResetEmail({ resetUrl, expiresIn }: {
  resetUrl: string;
  expiresIn: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>Reset your password</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={heading}>Password Reset</Text>
          <Text style={paragraph}>
            Someone requested a password reset for your account. If this
            was you, click the button below. If not, ignore this email.
          </Text>
          <Button style={button} href={resetUrl}>
            Reset Password
          </Button>
          <Text style={small}>
            This link expires in {expiresIn}. If the button does not work,
            copy and paste this URL: {resetUrl}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

---

## DNS Configuration

### Complete DNS Record Set

```
; SPF — authorize sending servers
example.com.       TXT   "v=spf1 include:amazonses.com include:sendgrid.net -all"

; DKIM — email signing (provider generates these)
sel1._domainkey.example.com.  CNAME  sel1.dkim.example.com.

; DMARC — policy for authentication failures
_dmarc.example.com.  TXT  "v=DMARC1; p=reject; rua=mailto:dmarc-reports@example.com; pct=100"

; Return-Path / Bounce domain
bounce.example.com.  CNAME  feedbackloop.provider.com.

; Separate subdomains
transactional.example.com.  TXT  "v=spf1 include:amazonses.com -all"
marketing.example.com.      TXT  "v=spf1 include:sendgrid.net -all"
```

See `email-authentication.md` for DMARC rollout strategy.

---

## Bounce Handling

### Webhook Handler (SendGrid)

```typescript
// POST /webhooks/sendgrid
async function handleSendGridWebhook(events: SendGridEvent[]) {
  for (const event of events) {
    switch (event.event) {
      case 'bounce':
        if (event.type === 'bounce') {
          // Hard bounce — permanent failure
          await markEmailInvalid(event.email, 'hard_bounce');
          await removeFromAllLists(event.email);
        }
        // Soft bounce — temporary, provider auto-retries
        break;

      case 'spamreport':
        // User marked as spam — must unsubscribe immediately
        await unsubscribeUser(event.email);
        await logComplaint(event.email, 'spam_report');
        break;

      case 'unsubscribe':
        await unsubscribeUser(event.email);
        break;

      case 'dropped':
        // Provider refused to send (previously bounced, etc.)
        await logDropped(event.email, event.reason);
        break;
    }
  }
}
```

### SNS Bounce Handler (SES)

```typescript
// Lambda function triggered by SNS topic
export async function handler(event: SNSEvent) {
  for (const record of event.Records) {
    const message = JSON.parse(record.Sns.Message);

    if (message.notificationType === 'Bounce') {
      const bounce = message.bounce;
      if (bounce.bounceType === 'Permanent') {
        for (const recipient of bounce.bouncedRecipients) {
          await markEmailInvalid(recipient.emailAddress, 'permanent_bounce');
        }
      }
    }

    if (message.notificationType === 'Complaint') {
      for (const recipient of message.complaint.complainedRecipients) {
        await unsubscribeUser(recipient.emailAddress);
      }
    }
  }
}
```

---

## Background Send Pattern

```typescript
// API handler — never send inline
async function handleRegistration(req: Request) {
  const user = await createUser(req.body);

  // Queue email send as background job
  await emailQueue.add('welcome', {
    to: user.email,
    templateId: 'welcome',
    variables: { name: user.name, loginUrl: generateLoginUrl(user) },
    idempotencyKey: `welcome-${user.id}`,
  });

  return { success: true }; // respond immediately
}

// Worker — handles retries, rate limiting
const emailWorker = new Worker('email', async (job) => {
  // Deduplicate
  const sent = await redis.get(`email:sent:${job.data.idempotencyKey}`);
  if (sent) return { skipped: true, reason: 'already_sent' };

  const html = await renderTemplate(job.data.templateId, job.data.variables);
  const text = await renderTextVersion(job.data.templateId, job.data.variables);

  await sendEmail(job.data.to, getSubject(job.data.templateId), html, text);

  // Mark as sent (TTL 7 days)
  await redis.set(`email:sent:${job.data.idempotencyKey}`, '1', 'EX', 604800);
}, {
  connection,
  limiter: { max: 50, duration: 1000 }, // 50 emails/sec
});
```

---

## IP Warm-Up Schedule

| Day | Daily Volume | Notes |
|-----|-------------|-------|
| 1-2 | 50-100 | Send to most engaged users only |
| 3-4 | 200-500 | Monitor bounce rate (< 2%) |
| 5-7 | 1,000 | Check spam complaint rate (< 0.1%) |
| 8-14 | 5,000 | Gradually add less engaged segments |
| 15-21 | 10,000-25,000 | Monitor inbox placement |
| 22-30 | 50,000+ | Full volume if metrics are healthy |

**Stop and investigate if:** bounce rate > 5%, complaint rate > 0.1%, or inbox placement drops below 90%.
