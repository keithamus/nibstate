// The `Get` type is a function that is passed to the Nib initializer
export type Get<T = any, S extends Nib<T> = Nib<T>> = (s: S) => S extends Nib<infer I> ? I : never

export class Nib<T> implements AsyncIterable<T> {
  #value
  #nexts = new Set<(v: T) => void>()

  constructor(init: T | ((get: Get<any>) => T)) {
    if (typeof init === 'function') {
      const clears = new Set<() => void>()
      const next = () => {
        for (const clear of clears) clear()
        this.value = (init as (get: Get<any>) => T)(track)
      }
      const track: Get<any> = (s: Nib<T>): T => {
        s.next(next)
        return s.value
      }
      next()
    } else {
      this.#value = init as T
    }
  }

  get value(): T {
    return this.#value!
  }

  set value(value: T) {
    if (Object.is(this.#value, value)) return
    this.#value = value
    const nexts = this.#nexts
    this.#nexts = new Set()
    for (const next of nexts) next(value)
  }

  next(fn: (v: T) => void): () => void {
    this.#nexts.add(fn)
    return () => this.#nexts.delete(fn)
  }

  map<B>(fn: (v: T) => B): Nib<B> {
    return new Nib((g: Get) => fn(g(this)))
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    yield this.value
    while (true) {
      yield await new Promise(r => this.next(r))
    }
  }
}

export function get<T>(x: Nib<T>): T {
  return x.value
}

export function set<T>(x: Nib<T>, value: T): void {
  x.value = value
}

export function nib<T>(init: T | ((get: Get<any>) => T)): Nib<T> {
  return new Nib(init)
}
