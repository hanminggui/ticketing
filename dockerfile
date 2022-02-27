FROM node:16.14.0-alpine AS build

WORKDIR /ticketing

COPY . .
RUN npx prisma generate
RUN yarn install
RUN yarn tsc

FROM node:16.14.0-alpine

ENV NODE_ENV=production

WORKDIR /ticketing

ADD ./package.json .
ADD ./yarn.lock .
RUN yarn install --prod -s

COPY --from=build /ticketing/dist dist
COPY --from=build /ticketing/node_modules/.prisma/client node_modules/.prisma/client


EXPOSE 3000
CMD ["node", "dist/index.js"]