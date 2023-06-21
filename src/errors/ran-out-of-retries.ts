import { RetryableError } from './retryable-error';

export class RanOutOfRetries extends RetryableError {
  constructor(
    retryConfig: { times: number; intervalMillis: number; backoffFactor: number },
    retryReason: { lastReturnedValue?: unknown; lastErrorThrown?: unknown }
  ) {
    super(
      'Ran out of retries while executing operation',
      { retryConfig, retryReason },
      retryReason.lastErrorThrown
    );
  }
}
