// adapted from angular's merge() function
function isObject(value) {
  // http://jsperf.com/isobject4
  return value !== null && typeof value === 'object';
}
function isRegExp(value) {
  return toString.call(value) === '[object RegExp]';
}
function isDate(value) {
  return toString.call(value) === '[object Date]';
}
function isElement(node) {
  return !!(node &&
    (node.nodeName  // we are a direct element
    || (node.prop && node.attr && node.find)));  // we have an on and find method part of jQuery API
}

/**
 * Deeply extends the destination object `dst` by copying own enumerable
 * properties from the `src` object(s) to `dst`. You can specify multiple `src`
 * objects. If you want to preserve original objects, you can do so by passing an
 * empty object as the target: `var object = angular.merge({}, object1,
 * object2)`.
 */
export default function merge(dst, ...objs) {
  for (var i = 0, ii = objs.length; i < ii; ++i) {
    var obj = objs[i];
    if (!isObject(obj)) {
      continue;
    }
    var keys = Object.keys(obj);
    for (var j = 0, jj = keys.length; j < jj; j++) {
      var key = keys[j];
      var src = obj[key];
      if (isObject(src)) {
        if (isDate(src)) {
          dst[key] = new Date(src.valueOf());
        } else if (isRegExp(src)) {
          dst[key] = new RegExp(src);
        } else if (src.nodeName) {
          dst[key] = src.cloneNode(true);
        } else if (isElement(src)) {
          dst[key] = src.clone();
        } else {
          if (!isObject(dst[key])) dst[key] = Array.isArray(src) ? [] : {};
          merge(dst[key], src);
        }
      } else {
        dst[key] = src;
      }
    }
  }
  return dst;
}
