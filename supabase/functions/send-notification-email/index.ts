const RESEND_API_KEY = 're_XPZ5Ww9v_CjrBArYztQE28VwU29BCH3YN';

const handler = async (request: Request): Promise<Response> => {
  const payload = await request.json();
  if (payload.type === 'INSERT' && payload.table === 'notifications') {
    const notification = payload.record;
    if (notification.type === 'low_stock') {
      const metadata = notification.metadata;
      const userEmail = metadata.user_email;
      console.log("🚀 ~ handler ~ userEmail:", userEmail)
      const notificationChannels: string[] = metadata.notification_channels || [];
      const lowStockAlertEnabled = metadata.low_stock_alert_enabled;
      console.log("🚀 ~ handler ~ lowStockAlertEnabled:", lowStockAlertEnabled)
      // console.log('')
      if (lowStockAlertEnabled && notificationChannels.includes('email') && userEmail) {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'onboarding@resend.dev', // Replace with your verified sender email
            to: userEmail,
            subject: notification.subject,
            html: `<p>${notification.content}</p>`,
          }),
        });

        if (!res.ok) {
          console.error('Failed to send email:', await res.text());
        }
      }
    }
  }
  return new Response('OK', { status: 200 });
};

Deno.serve(handler);