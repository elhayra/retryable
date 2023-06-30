import { RetryableError } from './retryable-error';

export class RanOutOfRetries extends RetryableError {
  constructor(
    retryConfig: { times: number; intervalMillis: number; backoffFactor: number },
    retryValueTriggers: Array<unknown>,
    retryExceptionTriggers: Array<unknown>
  ) {
    super('Ran out of retries while executing operation', {
      retryConfig,
      retryValueTriggers,
      retryExceptionTriggers,
    });
  }
}
