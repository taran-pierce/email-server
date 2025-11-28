// get env variables
const dotenv = require('dotenv');
dotenv.config();

["CONNECTION_STRING", "ALLOW_LIST", "DEV_ALLOW_LIST", "AZURE_EMAIL", "SECONDARY_EMAIL"].forEach(key => {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
});

const rateLimit = require("express-rate-limit");

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 10, // Only 5 requests/min per IP
  message: { code: 429, message: "Too many requests" }
});

const { EmailClient } = require("@azure/communication-email");

const connectionString = process.env.CONNECTION_STRING;
const client = new EmailClient(connectionString);

const dev = process.env.NODE_ENV !== 'production';
const cors = require('cors');

// create allow list
let allowList = [
  ...process.env.ALLOW_LIST.split(","),
  ...(dev ? process.env.DEV_ALLOW_LIST.split(",") : [])
].map(o => o.trim()).filter(Boolean);

// set up CORS options
var corsOptions = {
  origin: function(origin, callback) {
    if (!origin || allowList.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
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

const app = express();

app.set('trust proxy', 1);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use("/send/mail", limiter);

async function sendEmail(message) {
  try {
    const poller = await client.beginSend(message);
    const result = await poller.pollUntilDone();
    return result;
  } catch (err) {
    console.log("Azure Email Error:", err);
    throw err;
  }
}

/**
 * @async
 * @param {string} name - Customer name
 * @param {string} email - Customer email
 * @param {string} message - Message to be emailed from the customer
 */
async function main(name, email, message) {
  const { sendEmail } = require('./server'); // <-- use the exported version

  if (!name || !email || !message) {
    throw new Error("Missing required fields");
  }

  // Message to site owner
  let newMessage = `
    ${name} has been viewing your website and has some questions.

    Email: ${email}

    Message:
    ----------------------------------------
${message}
  `;

  const siteOwnerContacts = [
    { address: process.env.SECONDARY_EMAIL }
  ];

  if (process.env?.EXTRA_CONTACT_EMAIL) {
    siteOwnerContacts.push({ address: process.env.EXTRA_CONTACT_EMAIL });
  }

  const emailMessage = {
    senderAddress: process.env.AZURE_EMAIL,
    content: {
      subject: "Website Contact Form",
      plainText: newMessage,
    },
    recipients: {
      to: siteOwnerContacts,
    },
  };

  const customerMessage = `We have received your email and we will get in contact with you as soon as we can.\n
  Thank You, Caddo Lake Bayou Tours
  `;

  const customerEmailMessage = {
    senderAddress: process.env.AZURE_EMAIL,
    content: {
      subject: "Website Contact Form",
      plainText: customerMessage,
    },
    recipients: {
      to: [{ address: email }],
    },
  };

  try {
    const [result, customerResult] = await Promise.all([
      sendEmail(emailMessage).catch(err => ({ status: "Failed", error: err })),
      sendEmail(customerEmailMessage).catch(err => ({ status: "Failed", error: err }))
    ]);
    
    return { result, customerResult };
  } catch (error) {
    console.log("Error in main():", error);
    throw new Error("Email sending failed");
  }
}

// route for sending the email requests
app.post('/send/mail', [cors(corsOptions)], async (req, res) => {
  try {
    let reqBody = req.body;

    if (Object.keys(req.body).length === 1) {
      const maybeJson = Object.keys(req.body)[0];
      if (maybeJson.startsWith("{")) {
        try {
          reqBody = JSON.parse(maybeJson);
        } catch (err) {
          return res.status(400).json({ code: 400, message: "Malformed JSON payload" });
        }
      }
    }

    // Extract values
    const { name, email, message } = reqBody;

    const cleanName = name?.trim();
    const cleanEmail = email?.trim().toLowerCase();
    const cleanMessage = message?.trim();

    // basic checks
    if (!cleanName || !cleanEmail || !cleanMessage) {
      return res.status(400).send({
        code: 400,
        message: "Missing required fields",
      });
    }

    if (cleanName.length > 100) {
      return res.status(400).send({
        code: 400,
        message: "Name is too long",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).send({
        code: 400,
        message: "Invalid email format",
      });
    }

    if (cleanMessage.length > 5000) {
      return res.status(400).send({
        code: 400,
        message: "Message is too long",
      });
    }

    try {
      const mailData = await main(cleanName, cleanEmail, cleanMessage);

      if (mailData?.customerResult?.status === "Succeeded") {
        return res.status(201).send({
          code: 201,
          message: mailData.customerResult.status,
        });
      }

      return res.status(500).send({
        code: 500,
        message: "Email sending failed",
      });

    } catch (sendErr) {
      console.log("Send error:", sendErr);
      return res.status(500).send({
        code: 500,
        message: "Error sending email",
      });
    }

  } catch (error) {
    console.log("Route error:", error);
    return res.status(500).send({
      code: 500,
      message: "Server error",
    });
  }
});

// --- CORS ERROR HANDLER ---
app.use((err, req, res, next) => {
  if (err instanceof Error && err.message === "Not allowed by CORS") {
    return res.status(403).json({
      code: 403,
      message: "CORS blocked"
    });
  }
  next(err);
});

// Only start server if running directly, not when imported for tests
if (require.main === module) {
  // start server
  app.listen(port, (err) => {
    if (err) {
      console.log('err: ', err);

      throw err
    }

    console.log(`Listening on ${port}`);
  });
}

module.exports = { main, sendEmail, app };
