; This is a comment. It just stays where it is.

; We can have literals of various types
42   ; this is a number
"hello"   ; this is a string
#\m    ; this is a character
#t     ; this is a boolean
quuz   ; this is a symbol

; we can have expressions
(print "hello world")

; a child of this expression has a nested comment
(+ 
	1  ; this is a nested comment
	2)

(* (- 1 2) (+ 9 8))

; we can have if expressions
(if (positive? -5) (error "doesn't get here") 2)

; we can have nested if expressions
(if (> x 0) 
	"A"
   	(if (< x 0)
   		"B"
   		"C"))

; we can define a variable or two
(define FIRST-NAME "John")
(define LAST-NAME "Doe")

; we can have structures
(define-struct person (first-name last-name age country))

; which we can then make instances of
(define john (make-person FIRST-NAME LAST-NAME 28 "USA"))

; we can define functions
(define (years-to-seconds years) (* years 360 24 60 60))
(check-expect (years-to-seconds 0)        0)
(check-expect (years-to-seconds 2) 62208000)

(define (greet p)
  (format "Hello ~a from ~a. You've been alive for ~a seconds."
          (person-first-name p)
          (person-country p)
          (years-to-seconds (person-age p))))

; and we can call functions
(greet john)

; we can also evaluate boolean expressions
(and #t #f)

(or #t #f) ; this is an expression
