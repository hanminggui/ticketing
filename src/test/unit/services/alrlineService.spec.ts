import { expect } from 'chai';
import _ from 'underscore';
import * as airlineService from '../../../services/airlineService';

describe('airlineService', () => {
  describe('#mustBookTicket()', () => {
    it('0ms timeout *20 return all false and use time < 5ms', async () => {
      const begin = new Date().getTime();
      const results = await Promise.all(_.range(20).map(() => airlineService.mustBookTicket(0)));
      const end = new Date().getTime();
      expect(results.includes(true)).to.eq(false);
      expect(end - begin).to.lt(5);
    });
    it('249ms timeout *20 return all false and use time < 255ms', async () => {
      const begin = new Date().getTime();
      const results = await Promise.all(_.range(10).map(() => airlineService.mustBookTicket(249)));
      const end = new Date().getTime();
      expect(results.includes(true)).to.eq(false);
      expect(end - begin).to.lt(255);
    });
    it('3000ms timeout *10 return true and use time < 3000ms', async () => {
      const begin = new Date().getTime();
      const result = await Promise.race(_.range(5).map(() => airlineService.mustBookTicket(3000)));
      const end = new Date().getTime();
      expect(result).to.eq(true);
      expect(end - begin).to.lt(3000);
    });
    it('10000ms timeout *2 return true and use time between 250ms and 10000ms', async () => {
      const begin = new Date().getTime();
      const result = await Promise.race(_.range(2).map(() => airlineService.mustBookTicket(10000)));
      const end = new Date().getTime();
      expect(result).to.eq(true);
      expect(end - begin).to.gt(249);
      expect(end - begin).to.lt(10000);
    });
  });
});
