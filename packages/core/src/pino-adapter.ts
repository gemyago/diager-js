import type pino from 'pino';
import type { Context, ContextValues } from './context.js';
import { LogData, Logger, LogLevel } from './logger.js';

// Minimal pino logger interface that is needed to create a logger.
type PinoLogger = Pick<pino.Logger,
  'child' |
  'level' |
  'levelVal' |
  'error' |
  'warn' |
  'info' |
  'debug' |
  'trace' |
  'isLevelEnabled' |
  'levels'
>;

/**
 * This class is not exposed on purpose. Please use createRootPinoLogger function
 * to create logger instances.
 *
 * Using class here instead of factory function to reduce memory footprint
 * of logger instances. This is important because logger instances are created
 * quite frequently and using factory function will lead to methods allocation on
 * memory heap.
 */
class PinoLoggerAdapter implements Logger {
  private pinoLogger: PinoLogger;

  private context: Context<ContextValues>;

  private minLevel: number;

  constructor(
    pinoLogger: PinoLogger,
    context: Context<ContextValues>,
    minLevel: number,
    isRoot: boolean,
  ) {
    this.pinoLogger = pinoLogger;
    this.context = context;
    this.minLevel = minLevel;

    // Setting level in pino is somewhat heavy operation. We only need it for root logger
    // in practice. All child loggers will have the level derived from the root logger.
    if (isRoot) {
      // Set the level to min possible. We will do "manual" level filtering.
      // See isLevelEnabled method for more details.
      this.pinoLogger.level = 'trace';
    }
  }

  #createChild(bindings: Record<string, unknown>): Logger {
    return new PinoLoggerAdapter(
      this.pinoLogger.child(bindings),
      this.context,
      this.minLevel,
      false,
    );
  }

  withGroup(name: string): Logger {
    return this.#createChild({ group: name });
  }

  withData(data: LogData): Logger {
    return this.#createChild({ data });
  }

  withError(err: Error): Logger {
    return this.#createChild({ err });
  }

  write(level: LogLevel, msg: string): void {
    if (this.isLevelEnabled(level)) {
      this.pinoLogger[level]({ context: this.context.values }, msg);
    }
  }

  error(msg: string): void {
    this.write('error', msg);
  }

  warn(msg: string): void {
    this.write('warn', msg);
  }

  info(msg: string): void {
    this.write('info', msg);
  }

  debug(msg: string): void {
    this.write('debug', msg);
  }

  trace(msg: string): void {
    this.write('trace', msg);
  }

  isLevelEnabled(level: string): boolean {
    const levelVal = this.pinoLogger.levels.values[level];

    if (!levelVal) {
      return this.pinoLogger.isLevelEnabled(level);
    }

    const desiredMinLevelValue = this.context.values.minLogLevel
      ? this.pinoLogger.levels.values[this.context.values.minLogLevel]
      : this.minLevel;
    return levelVal >= desiredMinLevelValue;
  }
}

/**
 * Creates a root logger instance that is using underlying pino logger to write logs.
 * Usually you would create a single root logger per application and then use it to
 * create child loggers using withGroup method. Please prefer to avoid global loggers
 * and instead initialize your components with explicit logger instances.
 *
 * Please feel free to configure the pino logger instance as needed. Please note that the level
 * of the pino logger will be manipulated to allow context specific log level filtering.
 */
export function createRootPinoLogger(opts: {
  /**
   * Instance of the diagnostic context associated with this logger.
   */
  context: Context<ContextValues>;

  /**
   * Pino logger instance that will be used to write logs and create child loggers.
   * Please note that the level of the pino logger will be manipulated as needed so
   * do not change it after the root logger initialization.
   */
  pinoLogger: PinoLogger;
}): Logger {
  return new PinoLoggerAdapter(opts.pinoLogger, opts.context, opts.pinoLogger.levelVal, true);
}
