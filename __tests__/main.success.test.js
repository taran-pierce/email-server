const serverModule = require('../server');

describe('main() function - successful email sending', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  test('returns results when emails are sent successfully', async () => {
    jest.setTimeout(10000);

    // Spy on the sendEmail function inside the module
    const spy = jest.spyOn(serverModule, 'sendEmail')
      .mockResolvedValue({ status: 'Succeeded' });

    const result = await serverModule.main('Alice', 'alice@example.com', 'Hello!');

    expect(result.result.status).toBe('Succeeded');
    expect(result.customerResult.status).toBe('Succeeded');
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
