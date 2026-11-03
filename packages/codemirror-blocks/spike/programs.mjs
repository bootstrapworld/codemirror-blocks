export const programs = {
  define_let_cond: `; a comment
(define (f x)
  (let ([y (+ x 1)]
        [z "hi there"])
    (cond
      [(> y 3) y]
      [else   z])))

(f   2)`,
  multiline_call: `(define (area r)
  ; circle
  (* 3.14
     r
     r))

(area 5)
(string-append "a"   "b")`,
  nested_if: `(define (fact n)
  (if (= n 0)
      1
      (* n (fact (- n 1)))))
(fact 5)`,
};
