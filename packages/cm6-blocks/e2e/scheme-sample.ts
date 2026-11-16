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
