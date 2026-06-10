/**
 * Polyfills for APIs that pdf.js v6 uses but that older iOS Safari lacks.
 * Each one is a no-op on browsers that already support the API.
 *
 * Minimum versions on Safari:
 *  - Promise.withResolvers ........... 17.4
 *  - Promise.try ..................... 18.2  (pdf.js MessageHandler dispatch)
 *  - Uint8Array toBase64/fromBase64 .. 18.2  (pdf.js font handling)
 *  - ReadableStream async iteration .. 18.4  (pdf.js getTextContent does
 *    `for await (const chunk of stream)` — without this it throws
 *    "TypeError: undefined is not a function" on every page)
 *  - Response/Blob .bytes() .......... 18.4  (pdf.js standard-font fetching)
 */

const P = Promise as any
P.withResolvers ??= function withResolvers(this: PromiseConstructor) {
  let resolve!: (v: unknown) => void
  let reject!: (r?: unknown) => void
  const promise = new this((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
P.try ??= function tryFn(this: PromiseConstructor, fn: (...a: unknown[]) => unknown, ...args: unknown[]) {
  return new this(resolve => resolve(fn(...args)))
}

const RSProto = (globalThis as any).ReadableStream?.prototype
if (RSProto && !RSProto[Symbol.asyncIterator]) {
  RSProto.values ??= function values(this: any, { preventCancel = false } = {}) {
    const reader = this.getReader()
    return {
      async next() {
        try {
          const result = await reader.read()
          if (result.done) reader.releaseLock()
          return result
        } catch (e) {
          reader.releaseLock()
          throw e
        }
      },
      async return(value: unknown) {
        if (preventCancel) {
          reader.releaseLock()
        } else {
          await reader.cancel(value)
        }
        return { done: true, value }
      },
      [Symbol.asyncIterator]() { return this },
    }
  }
  RSProto[Symbol.asyncIterator] = RSProto.values
}

if (typeof Response !== 'undefined' && !(Response.prototype as any).bytes) {
  ;(Response.prototype as any).bytes = async function bytes(this: Response) {
    return new Uint8Array(await this.arrayBuffer())
  }
}
if (typeof Blob !== 'undefined' && !(Blob.prototype as any).bytes) {
  ;(Blob.prototype as any).bytes = async function bytes(this: Blob) {
    return new Uint8Array(await this.arrayBuffer())
  }
}

const U8 = Uint8Array as any
if (!U8.prototype.toBase64) {
  U8.prototype.toBase64 = function toBase64(this: Uint8Array) {
    let bin = ''
    for (let i = 0; i < this.length; i += 0x8000) {
      bin += String.fromCharCode(...this.subarray(i, i + 0x8000))
    }
    return btoa(bin)
  }
}
if (!U8.fromBase64) {
  U8.fromBase64 = function fromBase64(s: string) {
    const bin = atob(s)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  }
}

export {}
