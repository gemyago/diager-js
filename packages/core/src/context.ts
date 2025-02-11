import { AsyncLocalStorage } from 'async_hooks';
import { LogLevel } from './logger.js';

/**
 * Represents bare minimal set of context values. Can be extended with
 * application specific fields as needed.
 */
export type ContextValues = {
  /**
   * Correlation id that is associated with this context.
   */
  correlationId: string

  /**
   * Allows dynamic and context specific log level manipulation.
   * Logger implementation will not write logs below that level.
   */
  minLogLevel?: LogLevel
}

/**
 * Tiny abstraction on top of AsyncLocalStorage.
 * Allows storing and retrieving contextual data in a "thread local"
 * like way. This component works together with logger and can also
 * be used separately and by other components to produce context
 * aware telemetry
 */
export type Context<TValues extends ContextValues> = {
  /**
   * Returns values associated with a current context.
   */
  get values(): TValues

  /**
   * Will run given function with with provided values as a context.
   */
  run<TRes>(
    values: TValues, runnable: () => TRes
  ): TRes

  /**
   * Will run given function with current context is extended with given values.
   */
  child<TRes>(
    values: Partial<TValues>, runnable: () => TRes
  ): TRes
}

export function createContext<TValues extends ContextValues>(
  rootValues: TValues,
): Context<TValues> {
  const localStore = new AsyncLocalStorage<TValues>();
  const self: Context<TValues> = {
    get values(): TValues {
      return localStore.getStore() ?? rootValues;
    },

    run(values, runnable) {
      return localStore.run(values, runnable);
    },

    child(values, runnable) {
      const childValues = { ...self.values, ...values };
      return self.run(childValues, runnable);
    },
  };
  return self;
}
