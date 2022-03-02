import { expect } from 'chai';
import _ from 'underscore';
import { FakeAirlineService } from '../../services/airlineService';

describe('FakeAirlineService', () => {
  describe('#mustBookTicket()', () => {
    describe('0ms delay', () => {
      describe('0% fail rate', () => {
        let airlineService: FakeAirlineService;
        before(() => {
          airlineService = new FakeAirlineService(0, 0, 0);
        });

        it('0ms timeout * 100 all return false', async () => {
          const results = await Promise.all(_.range(100).map(() => airlineService.mustBookTicket(0)));
          expect(results.includes(true)).to.eq(false);
        });
        it('10ms timeout * 100 all return true', async () => {
          const results = await Promise.all(_.range(100).map(() => airlineService.mustBookTicket(10)));
          expect(results.includes(false)).to.eq(false);
        });
        it('0ms timeout use time < 2ms', async () => {
          const begin = new Date().getTime();
          await airlineService.mustBookTicket(0);
          const end = new Date().getTime();
          expect(end - begin).to.lt(2);
        });
        it('1ms timeout use time < 5ms', async () => {
          const begin = new Date().getTime();
          await airlineService.mustBookTicket(1);
          const end = new Date().getTime();
          expect(end - begin).to.lt(5);
        });
      });
      describe('100% fail rate', () => {
        let airlineService: FakeAirlineService;
        before(() => {
          airlineService = new FakeAirlineService(0, 0, 100);
        });

        it('1ms timeout * 100 all return false', async () => {
          const results = await Promise.all(_.range(100).map(() => airlineService.mustBookTicket(1)));
          expect(results.includes(true)).to.eq(false);
        });
        it('1ms timeout use time < 3ms', async () => {
          const begin = new Date().getTime();
          await airlineService.mustBookTicket(1);
          const end = new Date().getTime();
          expect(end - begin).to.lt(3);
        });
      });
      describe('50% fail rate', () => {
        let airlineService: FakeAirlineService;
        before(() => {
          airlineService = new FakeAirlineService(0, 0, 50);
        });

        it('1ms timeout * 100 return has true and false', async () => {
          const results = await Promise.all(_.range(100).map(() => airlineService.mustBookTicket(1)));
          expect(results.includes(true)).to.eq(true);
          expect(results.includes(false)).to.eq(true);
        });
      });
    });
    describe('has delay', () => {
      describe('2ms-3ms delay. 20 fail rate', () => {
        let airlineService: FakeAirlineService;
        before(() => {
          airlineService = new FakeAirlineService(2, 3, 20);
        });

        it('1ms timeout * 5 all return false', async () => {
          const results = await Promise.all(_.range(5).map(() => airlineService.mustBookTicket(1)));
          expect(results.includes(true)).to.eq(false);
        });
        it('3ms timeout * 100 return has true and false', async () => {
          const results = await Promise.all(_.range(100).map(() => airlineService.mustBookTicket(3)));
          expect(results.includes(true)).to.eq(true);
          expect(results.includes(false)).to.eq(true);
        });
        it('300ms timeout return true', async () => {
          const result = await airlineService.mustBookTicket(300);
          expect(result).to.eq(true);
        });
        it('3ms timeout used time between 2ms and 5ms', async () => {
          const begin = new Date().getTime();
          await airlineService.mustBookTicket(3);
          const end = new Date().getTime();
          console.log(end - begin);
          expect(end - begin).to.gt(1);
          expect(end - begin).to.lt(6);
        });
      });
      describe('250ms-3000ms delay. 20 fail rate', () => {
        let airlineService: FakeAirlineService;
        before(() => {
          airlineService = new FakeAirlineService(250, 3000, 20);
        });

        it('10000ms timeout Promise.race mustBookTicket() * 5 used time between 250ms and 10000ms return true', async () => {
          const begin = new Date().getTime();
          const result = await Promise.race(_.range(5).map(() => airlineService.mustBookTicket(10000)));
          const end = new Date().getTime();
          expect(result).to.eq(true);
          expect(end - begin).to.gt(249);
          expect(end - begin).to.lt(10001);
        });
      });
    });
  });
});
