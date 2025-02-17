#!/usr/bin/env tsx

/**
 * This example demonstrates how to use the unified logger interface
 * backed by pino logger and diag context.
 *
 * Please setup project as per README.md before running this example.
 * Once ready you can run this example using following command:
 * ./packages/examples/src/logging-basic.ts | pino-pretty
 */

import { ContextValues, createContext, createRootPinoLogger } from '@diager-js/core';
import { randomUUID } from 'crypto';
import pino from 'pino'; // eslint-disable-line import/no-extraneous-dependencies -- dev dependency used to only run example

type ApplicationContext = ContextValues & {
  // Application specific context values.
  ctxVal1: string
  ctxVal2: string
}

const ctx = createContext<ApplicationContext>({
  correlationId: randomUUID(),
  ctxVal1: randomUUID(),
  ctxVal2: randomUUID(),
});

const pinoLogger = pino.pino({
  level: 'info', // anything below info will not be logged (by default)
});

const logger = createRootPinoLogger({
  context: ctx,
  pinoLogger,
});

// All log messages below will have root context values
logger.info('Log message with toplevel context');
logger.withData({ key: 'value' }).info('Log message with toplevel context and data');
logger
  .withError(new Error('Example error'))
  .withData({ key: 'value' })
  .info('Log message with toplevel context including error and data');

// All log messages below have root context values with additional/overridden child context values
ctx.child({ correlationId: randomUUID() }, () => {
  logger.info('Log message with child context');
  logger.withData({ key: 'value' }).info('Log message with child context and data');
  logger
    .withError(new Error('Example error'))
    .withData({ key: 'value' })
    .info('Log message with child context including error and data');
});

// This will not be seen because pinoLogger has log level set to info.
logger.debug('This is a debug log message that you should NOT see');

// This will change min log level of all logs that are logged in scope of this child context
// to debug. This will not affect logs that are logged outside of this context.
ctx.child({ minLogLevel: 'debug' }, () => {
  logger.debug('This is a debug log message that you should see');
});
