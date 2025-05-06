// test-create-webhook.js
const crypto = require('crypto');
const axios = require('axios');

const SECRET = 'crBuxl5XgsIgl32WedmIdPWMZnAAF5l7y3Mz62fF';
const WEBHOOK_URL = 'https://a6a3-2a09-bac5-3b0c-172d-00-24f-2.ngrok-free.app/api/webhooks/create-item';

const payload = {
  event: 'item_created',
  item: {
    id: '85622452s26ss',
    userId: 'D2A50B9416724E79B5974F0B73F8DB3A',
    name: 'Test Item',
    description: 'Created via test script',
    price: '10.99',
    quantity: 85,
    categoryId: 42,
    condition_type: 0,
    size: 'M',
    brand: 'TestBrand',
    tags: ['foo', 'bar'],
    media: [],
  },
};

const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
const signature = crypto.createHmac('sha256', SECRET).update(rawBody).digest('hex');

axios.post(WEBHOOK_URL, rawBody, {
  headers: {
    'Content-Type': 'application/json',
    'x-paperclip-signature': signature,
  },
})
.then(res => console.log('✅', res.status, res.data))
.catch(err => {
  if (err.response) console.error('❌', err.response.status, err.response.data);
  else console.error(err);
});
