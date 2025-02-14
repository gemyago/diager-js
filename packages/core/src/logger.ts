import type pino from 'pino';
import type { Context, ContextValues } from './context.js';

interface LogData {
  [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

// TODO: Maybe make those an array or something.
export const LogLevel = {
  error: 'error',
  warn: 'warn',
  info: 'info',
  debug: 'debug',
  trace: 'trace',
} as const;

export type LogLevel = typeof LogLevel[keyof typeof LogLevel]

type LevelMethods<
  TLogLevels extends LogLevel,
> = {
  /**
   * Write a log entry with a given level. Please use withData or withError to include
   * them with the log being written.
   */
  [level in TLogLevels]: (msg: string) => void
}

/**
 * Unified logger interface. Key points:
 * 1. Standardizes the way error objects are included in logs
 * 2. Standardizes the way arbitrary data is included with log messages
 * 3. Standardizes the way child loggers are created
 */
export type Logger = LevelMethods<LogLevel> & {
  /**
   * Creates a child logger of a given group name.
   * The way group is written to an underlying logger
   * is implementation specific.
   */
  withGroup(name: string): Logger

  /*
  * Includes additional data with log output.
  * Note: you must call one of the level methods (like error or warn ...)
  * in order to have the log entry actually written. Calling just withData
  * is a noop.
  */
  withData(data: LogData): Omit<Logger, 'withData' | 'withGroup'>

  /*
  * Include error object with log output.
  * Note: you must call one of the level methods (like error or warn ...)
  * in order to have the log entry written. Calling just withError is a noop.
  */
  withError(error: unknown): Omit<Logger, 'withError' | 'withGroup'>

  /**
   * Clean way to write log with runtime defined level
   */
  write(level: LogLevel, msg: string): void

  /**
   * Allow runtime checking if given log level is enabled.
   * Can be used in performance critical scenarios where log data preparation
   * is a concern.
   */
  isLevelEnabled(level: LogLevel): boolean
}

/**
 * Creates a root logger instance that is using underlying pino logger to write logs.
 * Usually you would create a single root logger per application and then use create child loggers
 * using withGroup method to create loggers for individual application components. Please prefer to
 * avoid global loggers and instead initialize your components with explicit logger instances.
 *
 * Please feel free to configure the pino logger instance as needed. Please note that the level
 * of the pino logger will be manipulated to allow context specific log level filtering.
 */
export function createRootPinoLogger(opts: {
  /**
   * Instance of the diagnostic context associated with this logger.
   */
  context: Context<ContextValues>

  /**
   * Pino logger instance that will be used to write logs and create child loggers.
   * Please note that the level of the pino logger will be manipulated as needed so
   * do not change it after the root logger initialization.
   */
  pinoLogger: pino.Logger
}): Logger {
  function createPinoLoggerAdapter(pinoLogger: pino.Logger): Logger {
    const initialLevel = pinoLogger.levelVal;
    pinoLogger.level = 'trace'; // eslint-disable-line no-param-reassign -- we are filtering logs on our own so have to set this to min value
    const self: Logger = {
      withGroup(name) {
        return createPinoLoggerAdapter(pinoLogger.child({ group: name }));
      },

      withData(data) {
        return createPinoLoggerAdapter(pinoLogger.child({ data }));
      },

      withError(error) {
        return createPinoLoggerAdapter(pinoLogger.child({ err: error }));
      },

      write(level, msg) {
        if (self.isLevelEnabled(level)) {
          pinoLogger[level]({ context: opts.context.values }, msg);
        }
      },

      error(msg) {
        self.write('error', msg);
      },

      warn(msg) {
        self.write('warn', msg);
      },

      info(msg) {
        self.write('info', msg);
      },

      debug(msg) {
        self.write('debug', msg);
      },

      trace(msg) {
        self.write('trace', msg);
      },

      isLevelEnabled(level) {
        const levelVal = pinoLogger.levels.values[level];

        // If we don't know how to check it, we just delegate to pino
        if (!levelVal) {
          return pinoLogger.isLevelEnabled(level);
        }

        // We either use context "overridden" value or the initial value
        const desiredMinLevelValue = opts.context.values.minLogLevel
          ? pinoLogger.levels.values[opts.context.values.minLogLevel]
          : initialLevel;
        if (levelVal < desiredMinLevelValue) {
          return false;
        }
        return true;
      },
    };
    return self;
  }

  return createPinoLoggerAdapter(opts.pinoLogger);
}
