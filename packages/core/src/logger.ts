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
