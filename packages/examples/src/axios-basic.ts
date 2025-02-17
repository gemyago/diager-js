#!/usr/bin/env tsx

/* eslint-disable import/no-extraneous-dependencies -- dev deps are ok here */
import { createAxiosClientLogInterceptors, formatProducerUserAgent } from '@diager-js/axios';
import { ContextValues, createContext, createRootPinoLogger } from '@diager-js/core';
import axios from 'axios';
import { randomUUID } from 'crypto';
import pino from 'pino';

/**
 * This example demonstrates usage of axios client log interceptors.
 * Please setup project as per README.md before running this example.
 * Start express-basic example first:
 * ./packages/examples/src/express-basic.ts | pino-pretty
 *
 * To run the example, execute the following command:
 * ./packages/examples/src/axios-basic.ts | pino-pretty
 *
 * You should see a consistent correlationId with each log message.
 * When running with log level set to debug, server side should produce debug logs as well.
 */

const ctx = createContext<ContextValues>({
  correlationId: randomUUID(),
});

const logger = createRootPinoLogger({
  context: ctx,
  pinoLogger: pino.pino({
    level: 'info', // anything below info will not be logged (by default)
  }),
});

const axiosInstance = axios.create();

createAxiosClientLogInterceptors({
  userAgent: formatProducerUserAgent({
    name: '@diager-js/examples',
    version: '0.0.1',
    meta: { example: 'axios-basic' },
  }),
  context: ctx,
  logger: logger.withGroup('axios'),
}).attachTo(axiosInstance);

async function fetchPets() {
  logger.debug('Fetching pets');
  const res1 = await axiosInstance.get('http://localhost:3000/pets');
  logger.withData({ pets: res1.data }).info('Got pets');
}

async function main() {
  await fetchPets();

  // Child context that will propagate log level to debug for all logs (including server side)
  await ctx.child({ minLogLevel: 'debug' }, async () => {
    await fetchPets();
  });
}

main().catch((err) => {
  logger.withError(err).error('Failed to get pets');
  process.exit(1);
});
