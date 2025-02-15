import { Context, ContextValues } from '@diager-js/core';
import type { RequestHandler } from 'express';

/**
 * Initializes diag context with values from the request.
 */
export function createDiagMiddleware<
  TContextValues extends ContextValues = ContextValues
>(_: {
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
   * If the correlationId is not initialized after mapping headers, the middleware will generate
   * a new correlationId.
   *
   * If minLogLevel is not initialized after mapping headers, the values
   * will be attempted to be taken from X-Min-Log-Level header. Invalid
   * values will be discarded.
   */
  contextHeaders: Record<string, keyof TContextValues>;

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
  return (req, res, next) => {
    next();
  };
}
