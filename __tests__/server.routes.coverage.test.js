// __tests__/server.routes.test.js

const request = require('supertest');
const serverModule = require('../server'); // includes main(), sendEmail, app
const { app } = serverModule;

describe('/send/mail route', () => {
  const validPayload = {
    name: 'Alice',
    email: 'alice@example.com',
    message: 'Hello!'
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    // Mock sendEmail globally to prevent real emails
    jest.spyOn(serverModule, 'sendEmail').mockResolvedValue({ status: 'Succeeded' });
  });

  test('returns 201 when email is sent successfully', async () => {
    const res = await request(app)
      .post('/send/mail')
      .send(validPayload)
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Succeeded');
  });

  test('returns 400 when required fields are missing', async () => {
    const payload = { name: '', email: '', message: '' };

    const res = await request(app)
      .post('/send/mail')
      .send(payload)
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Missing required fields');
  });

  test('returns 400 for invalid email format', async () => {
    const payload = { name: 'Alice', email: 'bad-email', message: 'Hello!' };

    const res = await request(app)
      .post('/send/mail')
      .send(payload)
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid email format');
  });

  test('returns 400 when name is too long', async () => {
    const payload = { name: 'A'.repeat(101), email: 'alice@example.com', message: 'Hello!' };

    const res = await request(app)
      .post('/send/mail')
      .send(payload)
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Name is too long');
  });

  test('returns 400 when message is too long', async () => {
    const payload = { name: 'Alice', email: 'alice@example.com', message: 'A'.repeat(5001) };

    const res = await request(app)
      .post('/send/mail')
      .send(payload)
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Message is too long');
  });

  test('returns 500 if sendEmail fails', async () => {
    // Override mock to simulate failure
    jest.spyOn(serverModule, 'sendEmail').mockRejectedValue(new Error('Simulated failure'));

    const res = await request(app)
      .post('/send/mail')
      .send(validPayload)
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Email sending failed');
  });

  test('enforces rate limiting', async () => {
    // sendEmail remains mocked
    const requests = [];
    for (let i = 0; i < 11; i++) {
      requests.push(
        request(app)
          .post('/send/mail')
          .send(validPayload)
          .set('Content-Type', 'application/json')
      );
    }

    const responses = await Promise.all(requests);

    // The 11th request should be rate-limited
    expect(responses[10].status).toBe(429);
    expect(responses[10].body.message).toBe('Too many requests');
  });
});
