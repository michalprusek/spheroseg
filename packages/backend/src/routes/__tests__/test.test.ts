import request from 'supertest';
import { app } from '../../server';

describe('Test Endpoint', () => {
  it('should return status 200 and correct response', async () => {
    const response = await request(app).get('/api/test');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      message: 'API is working'
    });
  });
});