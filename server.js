const express = require('express')
const bodyParser = require('body-parser')
const dev = process.env.NODE_ENV !== 'production'
const app = express()

// set up nodemailer
const nodemailer = require("nodemailer")

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
    host: process.env.host,
    // for gmail to work options must be set up on the account
    // that is being used to send the mail
    service: 'gmail',
    port: 465,
    secure: true,
    auth: {
      user: process.env.email,
      pass: process.env.creds
    },
  });

  // send mail
  let info = await transporter.sendMail({
    from: `"${name}" <${email}>`,
    to: process.env.email, // list of receivers
    subject: "Website Contact Form", // Subject line
    text: newMessage, // plain text body
    envelope: {
      from: `"${name}" <${email}>`,
      to: process.env.email,
      replyTo: `"${name}" <${email}>`
    },
    messageId: `"${name}" <${email}>`,
  });
}

app.use(bodyParser.json({ type: 'application/x-www-form-urlencoded' }))

app.post('/send/mail', (req, res) => {
  // set vars for incoming POST
  const { name, email, message } = req.body

  // send mail
  main(name, email, message).catch(console.error)

  // send success response
  res.send('success')
})

app.listen(process.env.PORT || 3000, (err) => {
  if (err) throw err
  console.log(`Listening on ${process.env.PORT}`)
})