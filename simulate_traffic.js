// const http = require('http');

// function initiatePayment() {
//   const data = JSON.stringify({
//     merchant_id: 'demo-merchant',
//     amount: Math.floor(Math.random() * 5000) + 100,
//     payment_method: Math.random() > 0.5 ? 'UPI' : 'CARD',
//     customer_email: 'test@example.com'
//   });

//   const options = {
//     hostname: '127.0.0.1',
//     port: 3001,
//     path: '/api/v1/payments/initiate',
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//       'Content-Length': data.length
//     }
//   };

//   const req = http.request(options, (res) => {
//     let responseData = '';
//     res.on('data', (chunk) => {
//       responseData += chunk;
//     });
//     res.on('end', () => {
//       console.log('Payment initiated:', responseData);
//     });
//   });

//   req.on('error', (error) => {
//     console.error('Error initiating payment:', error.message);
//   });

//   req.write(data);
//   req.end();
// }

// console.log('Starting payment simulation traffic...');
// // Initiate one immediately
// initiatePayment();
// // And every 5 seconds
// setInterval(initiatePayment, 5000);
