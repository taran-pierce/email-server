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
const util = require("util");

const emailTimeoutMs = Number(process.env.ACS_SEND_TIMEOUT_MS || 30000);

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  message: { code: 429, message: "Too many requests" }
});

const { EmailClient } = require("@azure/communication-email");
const connectionString = process.env.CONNECTION_STRING;
const client = new EmailClient(connectionString);

const dev = process.env.NODE_ENV !== 'production';
const cors = require('cors');

const allowList = [
  ...process.env.ALLOW_LIST.split(","),
  ...(dev ? process.env.DEV_ALLOW_LIST.split(",") : [])
].map(o => o.trim()).filter(Boolean);

const corsOptions = {
  origin: function(origin, callback) {
    if (!origin || allowList.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  methods: 'POST',
  allowedHeaders: ['Accept', 'Content-Type']
};

const port = process.env.PORT || 3000;

const express = require('express');
const app = express();

app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use("/send/mail", limiter);

function withTimeout(promise, timeoutMs, timeoutMessage) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function sendEmail(message, label = 'email') {
  const startedAt = Date.now();

  console.log(`[ACS][${label}] before beginSend`, {
    senderAddress: message?.senderAddress,
    subject: message?.content?.subject,
    recipientCount: message?.recipients?.to?.length || 0,
    timeoutMs: emailTimeoutMs
  });

  try {
    const poller = await withTimeout(
      client.beginSend(message),
      emailTimeoutMs,
      `ACS beginSend timed out after ${emailTimeoutMs}ms for ${label}`
    );

    console.log(`[ACS][${label}] after beginSend returned poller`, {
      pollerExists: !!poller,
      pollerType: poller?.constructor?.name,
      elapsedMs: Date.now() - startedAt
    });

    const result = await withTimeout(
      poller.pollUntilDone(),
      emailTimeoutMs,
      `ACS pollUntilDone timed out after ${emailTimeoutMs}ms for ${label}`
    );

    console.log(`[ACS][${label}] after pollUntilDone`, {
      status: result?.status,
      id: result?.id,
      elapsedMs: Date.now() - startedAt
    });

    return result;
  } catch (err) {
    console.error(`[ACS][${label}] catch block - full error details:`, util.inspect(err, {
      showHidden: true,
      depth: null,
      colors: false
    }));
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
  if (!name || !email || !message) {
    throw new Error("Missing required fields");
  }

  let newMessage = `
    ${name} has been viewing your website and has some questions.

    Email: ${email}

    Message:
    ----------------------------------------
${message}
  `;

  const siteOwnerContacts = [{ address: process.env.SECONDARY_EMAIL }];

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
    const [siteOwnerResult, customerResult] = await Promise.all([
      sendEmail(emailMessage, 'site-owner').catch(err => ({ status: 'Failed', error: err })),
      sendEmail(customerEmailMessage, 'customer').catch(err => ({ status: 'Failed', error: err }))
    ]);

    return { result: siteOwnerResult, customerResult };
  } catch (error) {
    console.error("Error in main():", util.inspect(error, { depth: null, colors: false, showHidden: true }));
    throw new Error("Email sending failed");
  }
}

app.post('/send/mail', [cors(corsOptions)], async (req, res) => {
  try {
    let reqBody = req.body && typeof req.body === 'object' ? req.body : {};

    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length === 1) {
      const maybeJson = Object.keys(req.body)[0];
      if (typeof maybeJson === 'string' && maybeJson.startsWith("{")) {
        try {
          reqBody = JSON.parse(maybeJson);
        } catch (err) {
          return res.status(400).json({ code: 400, message: "Malformed JSON payload" });
        }
      }
    }

    const { name, email, message } = reqBody;
    const cleanName = name?.trim();
    const cleanEmail = email?.trim().toLowerCase();
    const cleanMessage = message?.trim();

    if (!cleanName || !cleanEmail || !cleanMessage) {
      return res.status(400).send({ code: 400, message: "Missing required fields" });
    }

    if (cleanName.length > 100) {
      return res.status(400).send({ code: 400, message: "Name is too long" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).send({ code: 400, message: "Invalid email format" });
    }

    if (cleanMessage.length > 5000) {
      return res.status(400).send({ code: 400, message: "Message is too long" });
    }

    try {
      const mailData = await main(cleanName, cleanEmail, cleanMessage);

      if (mailData?.customerResult?.status === "Succeeded") {
        return res.status(201).send({
          code: 201,
          message: mailData.customerResult.status,
        });
      }

      return res.status(500).send({ code: 500, message: "Email sending failed" });
    } catch (sendErr) {
      console.error("Send error:", util.inspect(sendErr, { depth: null, colors: false, showHidden: true }));
      return res.status(500).send({ code: 500, message: "Error sending email" });
    }
  } catch (error) {
    console.error("Route error:", util.inspect(error, { depth: null, colors: false, showHidden: true }));
    return res.status(500).send({ code: 500, message: "Server error" });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof Error && err.message === "Not allowed by CORS") {
    return res.status(403).json({ code: 403, message: "CORS blocked" });
  }

  console.error("Unhandled app error:", util.inspect(err, { depth: null, colors: false, showHidden: true }));
  return res.status(500).json({ code: 500, message: "Internal server error" });
});

if (require.main === module) {
  app.listen(port, (err) => {
    if (err) {
      console.error('err: ', err);
      throw err;
    }

    console.log(`Listening on ${port}`);
  });
}

module.exports = { main, sendEmail, app };
