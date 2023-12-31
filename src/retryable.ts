import { RanOutOfRetries } from './errors';
import { RetrySettings } from './retry-settings';
import { sleep } from './sleep';

//todo: document that run function should always be awaited because:
// it support both sync and async functions
// at the time it operates, the callback function return value should be resolved so it can be checked if a retry is needed or not based on the resolved value (a promise is not enough here)
// the setTimeout function can be used with a callback, but it's much cleaner and readable to use await in this case, which also requires run() func to be async
//todo: document that ive decided not to use default excption of Error, the user must define the triggers - no default triggers
//todo: provide a quick start guide example in the readme, and a detailed guide too
//todo: add the option to set a hooks callback function  (beforeRetry, onFailedRetry), which gets the value/exp, and retry details such as attemptNumber, and overall attempts, and millisUntilNextRetry

/**
 * This type ensure the user define the callback, and pass arguments
 * to it or use its return value appropriately with the correct types.
 */
type CallbackFunction<CBRetType, CBParams extends unknown[]> = (
  ...args: CBParams
) => CBRetType | Promise<CBRetType>;

/**
 * With this class you can create a retryable callback function.
 * The class allow you to configure the properties of retry, before executing
 * the callback function.
 *
 * Usage Examples:
 * ---
 * Create and execute a Retryable instance for callback function that takes two number arguments,
 * and return a string:
 * ```
 * const callbackFunc = (a: number, b: number): string => `${a+b}`;
 * const r = new Retryable<string, [number, number]>(callbackFunc);
 * await r.run(1, 2);
 * ```
 * ---
 * Create and execute a Retryable instance for callback function that takes one string argument,
 * and return nothing:
 * ```
 * const callbackFunc = (str: string): void => {};
 * const r = new Retryable<void, [string]>(callbackFunc);
 * await r.run('hello');
 * ```
 * ---
 * Create and execute a Retryable instance for callback function that takes no arguments, and
 * return nothing:
 * ```
 * const callbackFunc = (): void => {};
 * const r = new Retryable<void, []>(callbackFunc);
 * await r.run()
 * ```
 * ---
 * It is also possible to create Retryable class, and let Typescript infer the types automatically:
 * ```
 * const callbackFunc = (str: string): string => `I say: ${str}`;
 * const r = new Retryable(callbackFunc);
 * await r.run('hi there');
 * ```
 */
export class Retryable<CBRetType, CBParams extends unknown[]> {
  public readonly retry: RetrySettings<CBRetType>;
  public attempts: Array<{
    returnedValue?: CBRetType | Promise<CBRetType>;
    exceptionThrown?: unknown;
  }> = [];

  constructor(private callback: CallbackFunction<CBRetType, CBParams>, public id?: string) {
    this.retry = new RetrySettings();
    this.attempts = [];
  }

  /**
   * Run the callback function, and retry if one of the following conditions is met:
   * 1. An exception trigger was set, and that exception was thrown from the callback
   * 2. A value trigger was set, and that value was returned from the callback
   *
   * If no trigger was met, and the callback function ran successfully, this method
   * return the original callback function return value.
   *
   * If no trigger was met, and the callback function fail to run (throw), this method
   * will retry to run the callback function N times. If after N retries the callback
   * function still fails, this method will throw `RanOutOfRetries` exception
   */

  public async run(...args: CBParams): Promise<CBRetType> {
    this.attempts = [];

    let intervalMillis = this.retry._intervalMillis;
    const sleepBeforeNextTry = async () => {
      await sleep(intervalMillis + this.getRandomJitter());
      intervalMillis *= this.retry._backoffFactor;
    };

    for (let t = this.retry._times; t > 0; t--) {
      try {
        const retVal = await this.callback(...args);
        if (this.retry._isValueQualifyForRetry(retVal)) {
          this.attempts.push({ returnedValue: retVal });
          await sleepBeforeNextTry();
          continue;
        }
        return retVal;
      } catch (e: any) {
        if (this.retry._isErrorQualifyForRetry(e)) {
          this.attempts.push({ exceptionThrown: e });
          await sleepBeforeNextTry();
          continue;
        }
        throw e;
      }
    }

    throw new RanOutOfRetries(this.retry.getSettings(), this.attempts, this.id);
  }

  private getRandomJitter(): number {
    const min = this.retry._jitter.min;
    const max = this.retry._jitter.max;
    if (min === 0 && max === 0) {
      return 0;
    }
    return Math.floor(Math.random() * (max - min + 1) + min);
  }
}
