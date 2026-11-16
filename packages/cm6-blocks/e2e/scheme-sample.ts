// The program drawn by both editors for the look comparison (scheme-cm5.png, scheme-cm6.png).
export const SAMPLE = `; compute some things
(define x 5)
(define (area r) (* 3 r r))
(define (grade score)
  (cond [(>= score 90) "A"]
        [(>= score 80) "B"]
        [else "C"]))
(define sign (lambda (n) (if (< n 0) -1 1)))
(f "hello" #t y #\\a)
(g)
(+ (* 2 3) (area (square 4)))
`;

/** a program for the states: one block each to be focused, selected, collapsed, a blank, and a comment above the first */
export const STATES = `; a comment about x
(define x 5)
(f "a" 1)
(g 2)
(h (m 3 4) 5)
(k ... 1)
`;
