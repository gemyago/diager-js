import {
  Logger, LogLevel,
} from '@diager-js/core';
import type { RequestHandler } from 'express';

const nanoSecInMs = BigInt(1e6);

function getDurationMs(start: bigint) {
  return Number((process.hrtime.bigint() - start) / nanoSecInMs);
}

/**
 * Creates middleware that logs http access events. Prefer adding it
 * right after the diag middleware (but not before!).
 */
export function createAccessLogMiddleware(opts: {
  /**
   * Logger instance that will be used to log http access events.
   */
  logger: Logger,

  /**
   * Log level that should be used to write http access logs.
   * Default: 'info'
   */
  logLevel?: LogLevel

  /**
   * List of headers that should be obfuscated in the logs.
   * Default: ['Authorization', 'Proxy-Authorization']
   * */
  obfuscateHeaders?: string[],

  /**
   * List of paths that should be ignored from the logs.
   */
  ignorePaths?: string[],
}) : RequestHandler {
  const {
    logger,
    logLevel = 'info',
    ignorePaths = [],
  } = opts;

  // TODO: Support obfuscation of headers
  // TODO: Allow configuring single log entry (e.g combined start + end)

  return (req, res, next) => {
    const reqStart = process.hrtime.bigint();
    if (ignorePaths.includes(req.originalUrl)) {
      next();
      return;
    }
    const startProcessingData = {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      query: req.query,
    };

    const logData = logger.withData(startProcessingData);
    logData.write(logLevel, `START_PROCESSING_REQ: ${req.method} ${req.path}`);

    res.on('finish', () => {
      const endProcessingData = {
        statusCode: res.statusCode,
        route: req.route?.path,
        headers: res.getHeaders(),
        durationMs: getDurationMs(reqStart),
      };

      const endLogData = logger.withData(endProcessingData);
      endLogData.write(logLevel, `END_PROCESSING_REQ: ${res.statusCode} - ${req.path}`);
    });
    next();
  };
}
