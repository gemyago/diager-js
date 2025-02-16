import { Context, ContextValues } from '@diager-js/core';
import { randomUUID } from 'crypto';
import type { RequestHandler } from 'express';

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
   * will be attempted to be taken from X-Min-Log-Level header. Invalid
   * values will be discarded.
   */
  contextHeaders?: Record<string, keyof TContextValues>;

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
    let nextCorrelationId = req.header('X-Correlation-ID');
    if (nextCorrelationId === undefined) {
      nextCorrelationId = req.header('X-Request-ID');
    }
    if (nextCorrelationId === undefined) {
      nextCorrelationId = uuidFn();
    }
    const nextContextValues = {
      correlationId: nextCorrelationId,
    } as Partial<TContextValues>;
    context.child(nextContextValues, () => next());
  };
}
