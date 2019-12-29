const express = require('express')
const next = require('next')
const bodyParser = require('body-parser')
const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

// set up nodemailer and get creds
const nodemailer = require("nodemailer")

// get info for email
const c = require('./conf.js')

async function main(name, email, message){

  // set up message
  let newMessage = `${name} has been viewing your website and has some questions.\n
  Email them back at their email address: ${email}\n\n\n
  Message from ${name}:\n
  ________________________________________\n
  ${message}
  `

  // create transporter
  let transporter = nodemailer.createTransport({
    host: c.HOST,
    // for gmail to work options must be set up on the account
    // that is being used to send the mail
    service: 'gmail',
    port: 465,
    secure: true,
    auth: {
      user: c.USER,
      pass: c.PASS
    },
  });

  // send mail
  let info = await transporter.sendMail({
    from: `"${name}" <${email}>`,
    to: c.USER, // list of receivers
    subject: "Website Contact Form", // Subject line
    text: newMessage, // plain text body
    envelope: {
      from: `"${name}" <${email}>`,
      to: c.USER,
      replyTo: `"${name}" <${email}>`
    },
    messageId: `"${name}" <${email}>`,
  });
}

app.prepare().then(() => {
  const server = express()

  server.use(bodyParser.json())

  server.post('/helpers/form.php', (req, res) => {
    // set vars for incoming POST
    const { name, email, message } = req.body

    // send mail
    main(name, email, message).catch(console.error)

    // send success response
    res.send('success')
  })

  server.get('*', (req, res) => {
    return handle(req, res)
  })

  server.listen(3000, (err) => {
    if (err) throw err
    console.log('> Read on http://localhost:3000')
  })
})