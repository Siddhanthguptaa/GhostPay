// const axios = require('axios');

// const BASE_URL = 'http://localhost:3001/api/v1';

// async function run() {
//   try {
//     console.log('🚀 Seeding payments...');

//     // 1. Create dummy payments
//     for (let i = 0; i < 10; i++) {
//       const res = await axios.post(`${BASE_URL}/payments/initiate`, {
//   amount: Math.floor(Math.random() * 10000) + 100,
//   currency: 'INR',
//   payment_method: i % 2 === 0 ? 'UPI' : 'CARD',
//   user_id: `user_${i}`,
//   merchant_id: "merchant_demo_001",
//   status: "success"
// });

//       console.log(`✅ Payment ${i + 1} created`);
//     }

//     console.log('🧠 Running ghost detection...');

//     // 2. Run ghost detection
//     await axios.post(`${BASE_URL}/ghost/detect`);
//     console.log('✅ Detection complete');

//     console.log('📊 Fetching ghost flags...');

//     // 3. Get ghost flags
//     const flags = await axios.get(`${BASE_URL}/ghost/flags`);
//     console.log(`⚠️ Found ${flags.data?.data?.length || 0} ghost flags`);

// //     // 4. Generate audit reports for first few
// //     const sample = flags.data?.data?.slice(0, 3) || [];

// //     for (let f of sample) {
// //       await axios.post(`${BASE_URL}/audit/generate/${f.transaction_ref}`);
// //       console.log(`📝 Audit generated for ${f.transaction_ref}`);
// //     }

// //     console.log('🎉 DONE! अब frontend refresh कर');
// //   } catch (err) {
// //     console.error('❌ Error:', err.message);
// //   }
// }

// run();