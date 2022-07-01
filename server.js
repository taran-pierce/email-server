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
);

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
async function main(name, email, message){
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
} 

// data coming in from a form POST so parse it
app.use(bodyParser.urlencoded({extended: true}));

// route for sending the email requests
app.post('/send/mail', [cors(corsOptions)], (req, res, next) => {
  // set vars for incoming POST
  const reqBody = JSON.parse(Object.keys(req.body));

  const {
    name,
    email,
    message,
  } = reqBody;

  // use main to send email
  main(name, email, message).catch(console.error);

  // send success response
  res.send('success');
})

// start server
app.listen(port, (err) => {
  if (err) throw err
  console.log(`Listening on ${port}`);
});
