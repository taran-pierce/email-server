// __tests__/main.test.js
const serverModule = require('../server');
const { main, sendEmail } = serverModule;

describe('main() function', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  // --- Missing required fields ---
  test('throws an error when required fields are missing', async () => {
    await expect(main(null, 'test@example.com', 'Hello')).rejects.toThrow('Missing required fields');
    await expect(main('Alice', null, 'Hello')).rejects.toThrow('Missing required fields');
    await expect(main('Alice', 'test@example.com', null)).rejects.toThrow('Missing required fields');
  });

  // --- Success path ---
  test('returns results when emails are sent successfully', async () => {
    const spy = jest.spyOn(serverModule, 'sendEmail')
      .mockResolvedValue({ status: 'Succeeded' });

    const result = await main('Alice', 'alice@example.com', 'Hello!');

    expect(result.result.status).toBe('Succeeded');
    expect(result.customerResult.status).toBe('Succeeded');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  // --- sendEmail fails ---
  test('returns Failed status when sendEmail throws errors', async () => {
    const spy = jest.spyOn(serverModule, 'sendEmail')
      .mockRejectedValue(new Error('Azure failure'));

    const result = await main('Alice', 'alice@example.com', 'Hello!');

    expect(result.result.status).toBe('Failed');
    expect(result.customerResult.status).toBe('Failed');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  // --- Extra contact email included ---
  test('includes EXTRA_CONTACT_EMAIL when provided in environment', async () => {
    process.env.EXTRA_CONTACT_EMAIL = 'extra@example.com';
    const spy = jest.spyOn(serverModule, 'sendEmail')
      .mockResolvedValue({ status: 'Succeeded' });

    await main('Alice', 'alice@example.com', 'Hello!');

    // Check that the emailMessage recipients include both secondary and extra emails
    const callArg = spy.mock.calls[0][0];
    const addresses = callArg.recipients.to.map(r => r.address);
    expect(addresses).toContain(process.env.SECONDARY_EMAIL);
    expect(addresses).toContain('extra@example.com');

    delete process.env.EXTRA_CONTACT_EMAIL;
  });

  // --- Correct messages sent ---
  test('customer email contains correct message', async () => {
    const spy = jest.spyOn(serverModule, 'sendEmail')
      .mockResolvedValue({ status: 'Succeeded' });

    await main('Alice', 'alice@example.com', 'Hello!');
    
    const customerCall = spy.mock.calls[1][0];
    expect(customerCall.recipients.to[0].address).toBe('alice@example.com');
    expect(customerCall.content.plainText).toMatch(/We have received your email/);
  });
});
