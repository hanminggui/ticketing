import { expect } from 'chai';
import _ from 'underscore';
import { FakePayService } from '../../../services/payService';

describe('FakePayService', () => {
  describe('#pay()', () => {
    describe('0ms delay test fail rate', () => {
      describe('0% fail rate', () => {
        let payService: FakePayService;
        before(() => {
          payService = new FakePayService(0, 0, 0);
        });

        it('Promise.all pay() * 100 all return true', async () => {
          const results = await Promise.all(_.range(100).map(() => payService.pay()));
          expect(results.includes(false)).to.eq(false);
        });
        it('use time < 3ms', async () => {
          const begin = new Date().getTime();
          await payService.pay();
          const end = new Date().getTime();
          expect(end - begin).to.lt(3);
        });
      });
      describe('100% fail rate', () => {
        let payService: FakePayService;
        before(() => {
          payService = new FakePayService(0, 0, 100);
        });

        it('Promise.all pay() * 100 all return false', async () => {
          const results = await Promise.all(_.range(100).map(() => payService.pay()));
          expect(results.includes(true)).to.eq(false);
        });
        it('pay() use time < 3ms', async () => {
          const begin = new Date().getTime();
          await payService.pay();
          const end = new Date().getTime();
          expect(end - begin).to.lt(3);
        });
      });
      describe('50% fail rate', () => {
        let payService: FakePayService;
        before(() => {
          payService = new FakePayService(0, 0, 50);
        });

        it('Promise.all pay() * 100 return has true and false', async () => {
          const results = await Promise.all(_.range(100).map(() => payService.pay()));
          expect(results.includes(true)).to.eq(true);
          expect(results.includes(false)).to.eq(true);
        });
        it('pay() use time < 3ms', async () => {
          const begin = new Date().getTime();
          await payService.pay();
          const end = new Date().getTime();
          expect(end - begin).to.lt(3);
        });
      });
    });
    describe('has delay. test used time', () => {
      describe('2ms-3ms delay. 10 fail rate', () => {
        let payService: FakePayService;
        before(() => {
          payService = new FakePayService(2, 3, 10);
        });

        it('Promise.all pay() * 100 return has true and false', async () => {
          const results = await Promise.all(_.range(100).map(() => payService.pay()));
          expect(results.includes(true)).to.eq(true);
          expect(results.includes(false)).to.eq(true);
        });
        it('pay() used time between 2ms and 5ms', async () => {
          const begin = new Date().getTime();
          await payService.pay();
          const end = new Date().getTime();
          expect(end - begin).to.gt(1);
          expect(end - begin).to.lt(6);
        });
      });
      describe('250ms-3000ms delay. 10 fail rate', () => {
        let payService: FakePayService;
        before(() => {
          payService = new FakePayService(250, 3000, 10);
        });

        it('Promise.race pay() * 5 used time between 250ms and 3000ms', async () => {
          const begin = new Date().getTime();
          await Promise.race(_.range(5).map(() => payService.pay()));
          const end = new Date().getTime();
          expect(end - begin).to.gt(250);
          expect(end - begin).to.lt(3000);
        });
      });
    });
  });
});
