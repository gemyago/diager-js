import { Context, ContextValues, LogLevel } from '@diager-js/core';
import { randomUUID } from 'crypto';
import type { RequestHandler } from 'express';

type ParsedField<T> = { field: keyof T, parse: (value: string) => T[keyof T] | undefined };

type StringOrParsedFields<T> = {
  [K in keyof T]: T[K] extends string ? K | ParsedField<T> : ParsedField<T>;
}[keyof T];

/**
 * Initializes diag context with values from the request. This middleware
 * should usually be very first in the middleware chain.
 */
export function createDiagMiddleware<
  TContextValues extends ContextValues
>(deps: {
  /**
   * Instance of the diagnostic context associated with the middleware.
   * Will be used to store diagnostic information.
   */
  context: Context<TContextValues>;

  /**
   * Defines mapping between headers and context values where key is the
   * header name and value is a context value. The middleware
   * will assign corresponding context values from the headers.
   *
   * If the correlationId is not initialized after mapping headers,
   * the middleware will attempt X-Correlation-ID and X-Request-ID headers.
   * It will will generate a new correlationId as a last resort.
   *
   * If minLogLevel is not initialized after mapping headers, the values
   * will be attempted to be taken from X-Log-Level header. Invalid
   * values will be discarded.
   */
  contextHeaders?: Record<string, StringOrParsedFields<TContextValues>>;

  /**
   * Defines mapping between request parameters and context values where key is the
   * request parameter name and value is a context value.
   */
  contextParams?: Record<string, keyof Omit<TContextValues,
    'correlationId' | 'minLogLevel'>
  >;

  /**
   * @private
   */
  uuidFn?: () => string;
}): RequestHandler {
  const { uuidFn = randomUUID, context } = deps;
  return (req, res, next) => {
    const nextContextValues = {} as Partial<TContextValues>;
    for (const [header, contextField] of Object.entries(deps.contextHeaders ?? {})) {
      const headerValue = req.header(header);
      if (headerValue !== undefined) {
        if (typeof contextField === 'object' && 'field' in contextField) {
          nextContextValues[contextField.field] = contextField.parse(headerValue.toString());
        } else {
          nextContextValues[
            contextField as keyof TContextValues
          ] = headerValue.toString() as TContextValues[keyof TContextValues];
        }
      }
    }

    // Set correlationId from default headers if not set
    if (nextContextValues.correlationId === undefined) {
      nextContextValues.correlationId = req.header('X-Correlation-ID');
    }
    if (nextContextValues.correlationId === undefined) {
      nextContextValues.correlationId = req.header('X-Request-ID');
    }
    if (nextContextValues.correlationId === undefined) {
      nextContextValues.correlationId = uuidFn();
    }

    // Set minLogLevel from default headers if not set
    if (nextContextValues.minLogLevel === undefined) {
      const reqLogLevel = req.header('X-Log-Level')?.toString();
      if (reqLogLevel !== undefined) {
        nextContextValues.minLogLevel = reqLogLevel as LogLevel;
      }
    }

    // Strip bad log level values
    if (nextContextValues.minLogLevel && !(nextContextValues.minLogLevel in LogLevel)) {
      delete nextContextValues.minLogLevel;
    }
    context.child(nextContextValues, () => next());
  };
}
