// EXPERIMENT: a larger program per language, with the constructs the tables are checked against.
export const BIG: Record<string, string> = {
  scheme: `; a small program with comments
(define (f x) (+ x 1))
(define xs (list 1 2 3))
(define sq (lambda (x) (* x x)))
(define (show s) (display (string-append "n=" (number->string s))))
(define (grade score)
  (cond [(>= score 90) "A"]
        [else "C"]))
(let ([a 1] [b 2]) (+ a b))
(define v #(1 2 3))
(define c #\\a)
(and #t #f)
'(1 2 3)
(quote x)
`,
  javascript: `// a small program with comments
import { readFileSync } from "fs";
const limit = 10;
let names = ["a", "b"];
const point = { x: 1, y: "two" };
class Counter {
  constructor(start) {
    this.n = start;
  }
  inc() {
    this.n += 1;
    return this.n;
  }
}
function fact(n) {
  if (n <= 1) {
    return 1;
  }
  return n * fact(n - 1);
}
const double = (x) => x * 2;
const twice = function (f) { return f; };
for (const name of names) {
  console.log(name, point.x);
}
for (let i = 0; i < 3; i++) {
  total += i;
}
while (!done) {
  done = true;
}
const ok = a && b || !c;
const s = \`hi \${name}\`;
const r = cond ? 1 : 2;
`,
  python: `# a small program with comments
import os
from math import sqrt
limit = 10
names = ["a", "b"]
point = {"x": 1, "y": "two"}
class Counter:
    def __init__(self, start):
        self.n = start

    def inc(self):
        self.n += 1
        return self.n

def fact(n):
    if n <= 1:
        return 1
    elif n == 2:
        return 2
    else:
        return n * fact(n - 1)

double = lambda x: x * 2
for name in names:
    print(name, point["x"])
while not done:
    done = True
ok = a and b or not c
s = f"hi {name}"
r = 1 if cond else 2
total = [i * 2 for i in range(3)]
t = (1, 2)
`,
};
