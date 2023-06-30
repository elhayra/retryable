import { RanOutOfRetries } from './errors';
import { RetrySettings } from './retry-settings';
import { sleep } from './sleep';

//todo: document the Retryable type. for example, for callback func that get 2 numbers as arguemtns and return string: Retryable<string, [number, number]>
//todo: docuenet that the run() function should always be awaited for, even for sync functions because it support both sync and async, and it returns a promise
//todo: document the code
//todo: add gitlab pipline with lint and utests check

/**
 * This type ensure the user define the callback, and pass arguments
 * to it or use its return value appropriately with the correct types.
 */
type CallbackFunction<CBRetType, CBParams extends unknown[]> = (
  ...args: CBParams
) => CBRetType | Promise<CBRetType>;

export class Retryable<CBRetType, CBParams extends unknown[]> {
  public retry: RetrySettings<CBRetType>;
  public triggersHistory: {
    returnedValues: Array<CBRetType>;
    exceptionsThrown: Array<unknown>;
  };

  constructor(private callback: CallbackFunction<CBRetType, CBParams>) {
    this.retry = new RetrySettings();
    this.triggersHistory = {
      returnedValues: [],
      exceptionsThrown: [],
    };
  }

  private resetRetryTriggersHistory() {
    this.triggersHistory = {
      returnedValues: [],
      exceptionsThrown: [],
    };
  }

  public async run(...args: CBParams): Promise<CBRetType> {
    this.resetRetryTriggersHistory();
    let intervalMillis = this.retry._intervalMillis;
    const sleepWithBackoff = async () => {
      await sleep(intervalMillis);
      intervalMillis *= this.retry._backoffFactor;
    };

    for (let t = this.retry._times; t >= 0; t--) {
      try {
        const retVal = await this.callback(...args);
        const isValueQualifyForRetry = this.retry._returnedValues.has(retVal);
        if (isValueQualifyForRetry) {
          this.triggersHistory.returnedValues.push(retVal);
          sleepWithBackoff();
          continue;
        }
        return retVal;
      } catch (e: any) {
        const isErrorQualifyForRetry =
          Array.from(this.retry._errors.values()).find(
            (err) => err.constructor === e?.constructor
          ) ?? Array.from(this.retry._errors.values()).find((err) => e instanceof (err as any));

        if (isErrorQualifyForRetry) {
          this.triggersHistory.exceptionsThrown.push(e);
          sleepWithBackoff();
          continue;
        }
        throw e;
      }
    }

    throw new RanOutOfRetries(
      {
        times: this.retry._times,
        intervalMillis: this.retry._intervalMillis,
        backoffFactor: this.retry._backoffFactor,
      },
      this.triggersHistory.returnedValues,
      this.triggersHistory.exceptionsThrown
    );
  }
}
