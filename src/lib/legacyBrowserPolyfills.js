if (!String.prototype.replaceAll) {
  // iOS/Safari antigo nao tem replaceAll. Sem isso a tela da cozinha quebra ao montar classes CSS.
  // eslint-disable-next-line no-extend-native
  String.prototype.replaceAll = function replaceAllPolyfill(searchValue, replaceValue) {
    const source = String(this)
    if (searchValue instanceof RegExp) {
      return source.replace(searchValue, replaceValue)
    }
    return source.split(String(searchValue)).join(String(replaceValue))
  }
}

if (!Array.prototype.at) {
  // eslint-disable-next-line no-extend-native
  Array.prototype.at = function atPolyfill(index) {
    const length = this.length >>> 0
    let relativeIndex = Number(index) || 0
    if (relativeIndex < 0) {
      relativeIndex += length
    }
    if (relativeIndex < 0 || relativeIndex >= length) {
      return undefined
    }
    return this[relativeIndex]
  }
}

if (!Array.prototype.flat) {
  // eslint-disable-next-line no-extend-native
  Array.prototype.flat = function flatPolyfill(depth = 1) {
    const flattenDepth = Number(depth) || 0
    const result = []

    this.forEach((item) => {
      if (Array.isArray(item) && flattenDepth > 0) {
        result.push(...item.flat(flattenDepth - 1))
      } else {
        result.push(item)
      }
    })

    return result
  }
}

if (!Array.prototype.flatMap) {
  // eslint-disable-next-line no-extend-native
  Array.prototype.flatMap = function flatMapPolyfill(callback, thisArg) {
    return this.map(callback, thisArg).flat(1)
  }
}

if (!Object.fromEntries) {
  Object.fromEntries = function fromEntriesPolyfill(entries) {
    const object = {}
    for (const [key, value] of entries) {
      object[key] = value
    }
    return object
  }
}

if (!Object.hasOwn) {
  Object.hasOwn = function hasOwnPolyfill(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key)
  }
}
