# email-server
Simple email server for use as a contact form.

## Local Setup
- Clone and install using npm
- Set up local .env file
- Run command: `npm run start` to start Express server
- In a separate terminal send a POST to `127.0.0.1:[PORT]/send/mail`
  -  `curl -X POST 127.0.0.1:3000/send/mail -d "name=Taran&email=taran.tpdesign@gmail.com&message=Some test message"`
- With proper data in your `.env` file, you should be able to check the email account to see the message come through

## Deploy
Hosted on Heroku. More instructions to come on how to publish to production.
- Merges to master will automatically build and deploy to:
  - https://caddo-email-server.herokuapp.com/
  - http://custommail.caddolakebayoutours.com/

### Dependencies
* express - https://www.npmjs.com/package/express
* nodemailer - https://www.npmjs.com/package/nodemailer
* dotenv - https://www.npmjs.com/package/dotenv
* body-parser - https://www.npmjs.com/package/body-parser
* cors - https://www.npmjs.com/package/cors
