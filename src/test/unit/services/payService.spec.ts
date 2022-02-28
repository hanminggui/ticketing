import { expect } from 'chai';
import _ from 'underscore';
import * as payService from '../../../services/payService';

describe('payService', () => {
  describe('#pay()', () => {
    it('pay * 3 has return true and use time < 3010ms', async () => {
      const begin = new Date().getTime();
      const results = await Promise.all(_.range(3).map(() => payService.pay()));
      const end = new Date().getTime();
      expect(results.includes(true)).to.eq(true);
      expect(end - begin).to.lt(3010);
    });
    it('pay * 100 has return false and use time < 3010ms', async () => {
      const begin = new Date().getTime();
      const results = await Promise.all(_.range(100).map(() => payService.pay()));
      const end = new Date().getTime();
      expect(results.includes(false)).to.eq(true);
      expect(end - begin).to.lt(3010);
    });
    it('race pay * 5 use time < 2000ms', async () => {
      const begin = new Date().getTime();
      await Promise.race(_.range(5).map(() => payService.pay()));
      const end = new Date().getTime();
      expect(end - begin).to.lt(2000);
    });
  });
});
