const request = require('supertest');
const { app } = require('../server');

describe('/send/mail route', () => {
  const serverModule = require('../server');
  jest.setTimeout(15000); // 15 seconds

  beforeAll(() => {
    jest.spyOn(serverModule, 'sendEmail').mockResolvedValue({ status: 'Succeeded' });
  });

  const validPayload = {
    name: 'Alice',
    email: 'alice@example.com',
    message: 'Hello, this is a test.'
  };

  test('returns 201 when email is sent successfully', async () => {
    const res = await request(app)
      .post('/send/mail')
      .send(validPayload)
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(201);
    expect(res.body.code).toBe(201);
    expect(res.body.message).toBe('Succeeded');
  });

  test('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/send/mail')
      .send({ name: 'Alice' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Missing required fields');
  });  

  // --- NEW TESTS ---
  test('blocks requests from disallowed CORS origins', async () => {
    const res = await request(app)
      .post('/send/mail')
      .set('Origin', 'http://disallowed-origin.com')
      .send(validPayload)
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('CORS blocked');
  });

  test('enforces rate limiting', async () => {
    // Make 11 requests in a loop to exceed the limit of 10/min
    let lastResponse;
    for (let i = 0; i < 11; i++) {
      lastResponse = await request(app)
        .post('/send/mail')
        .send(validPayload)
        .set('Content-Type', 'application/json');
    }

    // The 11th request should be blocked
    expect(lastResponse.status).toBe(429);
    expect(lastResponse.body.message).toBe('Too many requests');
  });
});
