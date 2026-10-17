import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('devuelve status ok', () => {
    expect(new HealthController().check()).toMatchObject({ status: 'ok' });
  });
});
