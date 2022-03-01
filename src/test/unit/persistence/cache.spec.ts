// import { expect } from 'chai';
// import _ from 'underscore';
// import { PrismaClient, traveler } from '@prisma/client';
// import cache from '../../../persistence/cache';
// // import { Traveler } from '../../../types';

// describe('cache', () => {
//   const prisma = new PrismaClient();

//   before(async () => {
//     await prisma.$connect();
//   });

//   describe('#getTravelerById()', () => {
//     let minId: number;

//     before(async () => {
//       const minTraveler = await prisma.traveler.findFirst({ orderBy: { id: 'asc' } });
//       if (!minTraveler) {
//         throw Error('table traveler is empty');
//       }
//       minId = minTraveler.id;
//     });

//     it('input minId - 1 return null', async () => {
//       const result = await cache.getTravelerById(minId - 1);
//       expect(result).to.eq(null);
//     });
//     it('input minId return correct Traveler', async () => {
//       const result = await cache.getTravelerById(minId);
//       expect(result).not.to.eq(null);
//       expect(result?.id).to.eq(minId);
//     });
//   });

//   after(async () => {
//     await prisma.$disconnect();
//   });
// });
