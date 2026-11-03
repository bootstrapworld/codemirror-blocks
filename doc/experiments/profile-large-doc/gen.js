// Deterministic WeScheme documents of about N lines: nested define/cond/let
// with comments. Each top-level form group is 11 lines.
function form(i) {
  const n = i * 7;
  return [
    `; function ${i}: classify and combine`,
    `(define (f${i} x y)`,
    `  (cond`,
    `    [(< x ${n}) (let ([a (+ x ${i})] [b (* y 2)]) (+ a b))]  ; small case`,
    `    [(= x ${n + 1}) (let ([c (- y ${i})]) (if (> c 0) (* c c) (- c)))]`,
    `    [(> y ${n}) (string-append "big-${i}" (number->string (+ x y)))]`,
    `    [else (let* ([d (* x ${i + 1})] [e (+ d y)]) (max d e ${n}))]))`,
    `(check-expect (f${i} 1 2) ${i + 4})`,
    `(define k${i} ${n}) ; a constant`,
    `(define (g${i} lst) (map (lambda (z) (f${i} z ${i})) lst))`,
    ``,
  ];
}

module.exports = function gen(lines) {
  const out = [];
  for (let i = 0; out.length < lines; i++) out.push(...form(i));
  return out.join("\n");
};
