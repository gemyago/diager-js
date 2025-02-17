import { ContextValues, Context, Logger } from '@diager-js/core';
import type {
  AxiosError,
  AxiosInstance,
  AxiosResponse,
} from 'axios';
import { EventEmitter, Readable } from 'stream';

type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

export interface ProducerInfo {
  name: string
  version: string
  meta?: Record<string, string>
}

/**
 * Access log interceptors for Axios client. Attach it to Axios instance
 * to log requests and responses and propagate context values to upstream services.
 */
export interface AxiosClientLogInterceptors {
  /**
   * Attach interceptors to a given Axios instance
   * @param instance Axios instance to attach interceptors to
   */
  attachTo(instance: AxiosInstance): void;
}

/**
 * Format user agent string that allows identifying producer of the request.
 */
export function formatProducerUserAgent(producer: ProducerInfo): string {
  const meta = producer.meta ? ` (${Object.entries(producer.meta).map(([k, v]) => `${k}=${v}`).join('; ')})` : '';
  return `${producer.name}/${producer.version} node/${process.version}${meta}`;
}

function dumpResponseData(target?: unknown | { read: () => unknown }) {
  if (!target) {
    return undefined;
  }
  const isStream = target instanceof EventEmitter && 'read' in target && typeof target.read === 'function';
  if (!isStream) {
    return target;
  }
  const readable = target as Readable;
  return Buffer.from(readable.read()).toString('utf8');
}

interface ResponseData {
  status: number
  data: unknown
}

// eslint-disable-next-line import/prefer-default-export
export class HttpTransportError extends Error {
  #cause : Error;

  readonly response?: ResponseData;

  get cause(): Error {
    return this.#cause;
  }

  constructor(err : AxiosError, data?: unknown) {
    super(err.message);
    this.name = 'HTTP_TRANSPORT_ERROR';
    this.#cause = err;
    if (err.isAxiosError) {
      this.response = {
        status: err.response?.status as number,
        data: data ?? err.response?.data,
      };
    }
  }
}

export function createAxiosClientLogInterceptors<TContextValues extends ContextValues>(params: {
  userAgent: string,
  logger: Logger,
  context: Context<TContextValues>
  logLevel?: LogLevel
}) : AxiosClientLogInterceptors {
  // TODO: Obfuscate headers

  // TODO: Allow combining start and end log messages into a single one to reduce logs volume

  const {
    context,
    logger,
    userAgent,
  } = params;

  const defaultLogLevel = params.logLevel || 'info';

  const writeLogEndMessage = (logLevel: LogLevel, res: AxiosResponse, data?: unknown) => {
    logger.withData({
      statusCode: res?.status,
      headers: res?.headers,
      body: data,
    }).write(logLevel, `SEND_REQUEST_COMPLETED: ${res?.status} - ${res?.config.url}`);
  };

  return {
    attachTo(instance) {
      instance.interceptors.request.use(
        (req) => {
          if (!req.headers.has('User-Agent')) {
            req.headers.set('User-Agent', userAgent);
          }
          const ctx = context.values;
          if (ctx) {
            if (ctx.correlationId) {
              req.headers.set('x-correlation-id', ctx.correlationId);
            }
            if (ctx.minLogLevel) {
              req.headers.set('X-Log-Level', ctx.minLogLevel);
            }
          }
          logger.withData({
            baseURL: req.baseURL,
            headers: req.headers,
            method: req.method?.toUpperCase(),
            path: req.url,
          }).write(defaultLogLevel, `SEND_REQUEST_STARTED: ${req.method?.toUpperCase()} ${req.url}`);
          return req;
        },
      );
      instance.interceptors.response.use(
        (res: AxiosResponse) => {
          writeLogEndMessage(defaultLogLevel, res);
          return res;
        },
        (err) => {
          const errorData = dumpResponseData(err.response?.data);
          if (err.isAxiosError) {
            const axiosErr = err as AxiosError;
            const res = axiosErr.response;
            writeLogEndMessage(defaultLogLevel, res as AxiosResponse, errorData);
          }
          return Promise.reject(new HttpTransportError(err, errorData));
        },
      );
    },
  };
}
