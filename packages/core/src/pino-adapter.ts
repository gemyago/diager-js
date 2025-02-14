import type pino from 'pino';
import type { Context, ContextValues } from './context.js';
import { Logger } from './logger.js';

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
  context: Context<ContextValues>;

  /**
   * Pino logger instance that will be used to write logs and create child loggers.
   * Please note that the level of the pino logger will be manipulated as needed so
   * do not change it after the root logger initialization.
   */
  pinoLogger: PinoLogger;
}): Logger {
  function createPinoLoggerAdapter(pinoLogger: PinoLogger): Logger {
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
