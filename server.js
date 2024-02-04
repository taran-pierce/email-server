// get env variables
const dotenv = require('dotenv');
dotenv.config();

const dev = process.env.NODE_ENV !== 'production';
const cors = require('cors');
const allowList = [
  'https://www.caddolakebayoutours.com',
  'https://www.caddolakebayoutours.com/',
  'https://dev.caddolakebayoutours.com/',
  'https://dev.caddolakebayoutours.com',
  'https://caddolakebayoutours.com/',
  'https://caddolakebayoutours.com',
  'http://www.caddolakebayoutours.com:3000',
  'http://www.caddolakebayoutours.com:3000/',
];

// add to allowList
dev && allowList.push(
  'http://127.0.0.1/',
  'http://127.0.0.1',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3000/',
  'localhost',
  'localhost/',
  'http://localhost:3000',
  'http://localhost:3000/',
  'http://localhost:3001',
  'http://localhost:3001/',
);

// set up CORS options
var corsOptions = {
  origin: function (origin, callback) {
    if (allowList.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  methods: 'POST',
  allowedHeaders: [
    'Accept',
    'Content-Type',
  ]
};

const port = process.env.PORT || 3000;

// set up express
const express = require('express');
const bodyParser = require('body-parser');

const app = express();

// set up nodemailer
const nodemailer = require("nodemailer");

// get required variables
const {
  email: supportEmail,
  host,
  creds,
} = process.env;

/**
 * Use nodemailer to send an email with return information
 * @async
 * @param {string} name - Customer name
 * @param {string} email - Customer email
 * @param {string} message - Message to be emailed from the customer
 */
async function main(name, email, message) {
  if (!name || !email || !message) {
    throw new Error('Info is missing!');
  }
  // set up message so we know who was viewing the form
  // this will be forwarded to another email
  let newMessage = `${name} has been viewing your website and has some questions.\n
  Email them back at their email address: ${email}\n\n\n
  Message from ${name}:\n
  ________________________________________\n
  ${message}
  `;

  // create transporter
  let transporter = nodemailer.createTransport({
    host: host,
    service: 'smtp',
    port: 465,
    secure: true,
    auth: {
      user: supportEmail,
      pass: creds,
    },
    tls: {
      rejectUnauthorized: false,
      // requestCert: true,
      // agent: false,
    }
  });

  // sending email using caddo email account
  let info = await transporter.sendMail({
    from: `Info <${supportEmail}>`,
    to: `Info <${supportEmail}>`, // list of receivers
    subject: "Website Contact Form", // Subject line
    text: newMessage, // plain text body
    messageId: `${name}`,
  });

  return info;
} 

// data coming in from a form POST so parse it
app.use(bodyParser.urlencoded({extended: true}));

// route for sending the email requests
app.post('/send/mail', [cors(corsOptions)], (req, res, next) => {
  const reqBody = typeof req.body === 'object' ? JSON.parse(Object.keys(req.body)) : req.body;

  // set vars for incoming POST
  const {
    name,
    email,
    message,
  } = reqBody;

  console.log('Preparing to send email...');
  console.log(`${name} (${email})`);

  // use main to send email
  const sendMail = async () => {
    const mailData = await main(name, email, message).catch((error) => {
      console.error;

      console.log(`There was an error: ${error} `);

      res.status(500).send('Error sending email')
    });

    if (!mailData) {
      console.log('Stopping because there was no mailData');
      return;
    }

    // get info to check status of the result
    const { response } = mailData;
    const [statusCode] = response.split(' ');

    // not sure the entire range Express returns so looking for any 200-299
    const isSuccess = response && /\b(2[0-9]{2})\b/.test(statusCode);

    if (isSuccess) {
      console.log(`Response was: ${statusCode}`);
      // just going to send Express a 200 though
      res.status(200).send('success')
    }

    if (!isSuccess) {
      console.log(`There was an issue: ${statusCode}`);
      res.status(Number(statusCode)).send('error');
    }

    return mailData;
  };

  sendMail();
})

// start server
app.listen(port, (err) => {
  if (err) {
    console.log('err: ', err);

    throw err
  }

  console.log(`Listening on ${port}`);
});
