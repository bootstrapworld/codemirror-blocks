; This is a comment

; we can define variables
(define SOME-FUNC (bitmap/url "http://world.cs.brown.edu/1/clipart/cow-left.png"))

; we can have structs
(define-struct cow (p dir))

; we can define functions with conditionals
(define (draw-cows aloc scene)
  (cond
    [(empty? aloc) scene]
    [(cons? aloc) (place-image (cond
                                 [(string=? (cow-dir (first aloc)) "right")
                                  COW-RIGHT]
                                 [(string=? (cow-dir (first aloc)) "left")
                                  COW-LEFT])
                               (posn-x (cow-p (first aloc)))
                               (posn-y (cow-p (first aloc)))
                               (draw-cows (rest aloc) scene))]))



(define (draw w)
  (draw-cows (world-cows w)
             (draw-ufo (world-ufo w)
                       BACKGROUND (if (anything-touching-cow? (world-ufo w)
                                                              HALF-UFO-WIDTH
                                                              HALF-UFO-HEIGHT
                                                              (world-cows w)) UFO-CAPTURE UFO))))

; move-ufo-y: world -> world
; move-ufo-y consumes a world and produces a world with the ufo moved down
(define (move-ufo-y w)
  (make-world (make-posn (posn-x (world-ufo w))
                         (+ UFO-SPEED (posn-y (world-ufo w))))
              (world-cows w)))

(check-expect (move-ufo-y world-test) (make-world (make-posn 10 15)
                                                  (list cow0 cow1)))

; move-ufo-x: world key -> world
; move-ufo-x consumes a world and key and produces a world with the ufo moved by keys
(define (move-ufo-x w key)
  (make-world 
   (make-posn  
    (cond
      [(and (key=? key "left") (not (hitting-wall? (world-ufo w) "left")))
       (- (posn-x (world-ufo w)) UFO-SPEED)]
      [(and (key=? key "right") (not (hitting-wall? (world-ufo w) "right")))
       (+ (posn-x (world-ufo w)) UFO-SPEED)]
      [else (posn-x (world-ufo w))])
    (posn-y (world-ufo w)))
   (world-cows w)))

(check-expect (move-ufo-x world-test "left") (make-world (make-posn 5 10) 
                                                         (list cow0 cow1)))
(check-expect (move-ufo-x world-test "right") (make-world (make-posn 15 10) 
                                                          (list cow0 cow1)))
(check-expect (move-ufo-x world-test "") (make-world (make-posn 10 10) 
                                                     (list cow0 cow1)))

;ufo-done? : world -> boolean
;consumes a world and returns true if the ufo is touching any cow or the ground; otherwise, returns false
(define (ufo-done? w)
  (or
   (anything-touching-cow? (world-ufo w)
                           HALF-UFO-WIDTH
                           HALF-UFO-HEIGHT
                           (world-cows w))
   (hitting-wall? (world-ufo w) "down")))

(check-expect (ufo-done? world-test) false)
(check-expect (ufo-done? (make-world (make-posn 20 (- SCREEN-HEIGHT 20)) (list (make-cow
                                                                                (make-posn 20 (- SCREEN-HEIGHT 20))
                                                                                "right"))))
              true)
(check-expect (ufo-done? (make-world (make-posn 0 (+ SCREEN-HEIGHT 5)) empty)) true)

;anything-touching-cow? : posn num num list-of-posns -> boolean
;anything-touching-cow? consumes a posn, an image height, an image width, and a list-of-cows and returns true if the image at the posns is touching any of the cows in the list based on the image height and width, otherwise returns false
(define (anything-touching-cow? img-p img-w img-h aloc)
  (cond
    [(empty? aloc) false]
    [(cons? aloc)
     (or 
      (and
       (or
        (and (>= (- (posn-x img-p) img-w) (- (posn-x (cow-p (first aloc))) HALF-COW-WIDTH))
             (<= (- (posn-x img-p) img-w) (+ (posn-x (cow-p (first aloc))) HALF-COW-WIDTH)))
        (and (>= (+ (posn-x img-p) img-w) (- (posn-x (cow-p (first aloc))) HALF-COW-WIDTH))
             (<= (+ (posn-x img-p) img-w) (+ (posn-x (cow-p (first aloc))) HALF-COW-WIDTH))))
       (>= (+ (posn-y img-p) img-h) (- (posn-y (cow-p (first aloc))) HALF-COW-HEIGHT)))
      (anything-touching-cow? img-p img-w img-h (rest aloc)))]))

(check-expect (anything-touching-cow? (make-posn 0 0) 0 0 empty) false)
(check-expect (anything-touching-cow? (make-posn (/ SCREEN-WIDTH 2) 20) 
                                      HALF-UFO-WIDTH 
                                      HALF-UFO-HEIGHT 
                                      (list cow0))
              false)
(check-expect (anything-touching-cow? (make-posn 20 (- SCREEN-HEIGHT HALF-COW-HEIGHT)) 
                                      HALF-UFO-WIDTH 
                                      HALF-UFO-HEIGHT 
                                      (list cow0))
              false)
(check-expect (anything-touching-cow? (make-posn (/ SCREEN-WIDTH 2) (- SCREEN-HEIGHT HALF-COW-HEIGHT)) 
                                      HALF-UFO-WIDTH 
                                      HALF-UFO-HEIGHT 
                                      (list cow0))
              true)

;remove-cow-from-list : cow list-of-cows -> list-of-cows
;remove-cow-from-list consumes a cow and a list-of-cows and returns a list-of-cows with cow removed
(define (remove-cow-from-list c aloc)
  (cond
    [(empty? aloc) empty]
    [(cons? aloc) (cond
                    [(posn=? (cow-p c) (cow-p (first aloc))) (rest aloc)]
                    [else (cons (first aloc) (remove-cow-from-list c (rest aloc)))])]))

(check-expect (remove-cow-from-list cow0 empty) empty)
(check-expect (remove-cow-from-list cow0 (list cow1 cow0 cow2)) (list cow1 cow2))

;process-cows : world  -> world
;process-cows consumes a world  and produces a world with the cows moved and hit-tested
(define (process-cows w)
  (make-world (world-ufo w) (move-cows (new-dirs (world-cows w) (world-cows w)))))

(check-expect (process-cows world-test) (make-world (make-posn 10 10)
                                                    (list
                                                     (make-cow (make-posn (+ 2 (/ SCREEN-WIDTH 2))
                                                                          (- SCREEN-HEIGHT HALF-COW-HEIGHT))
                                                               "right")
                                                     (make-cow (make-posn (+ 2 (/ SCREEN-WIDTH 4))
                                                                          (- SCREEN-HEIGHT HALF-COW-HEIGHT))
                                                               "right"))))

;move-all-on-tick : world -> world
;move-all-on-tick consumes a world and produces a world with all objects inside of it moved every "tick" of big-bang
(define (move-all-on-tick w)
  (process-cows (move-ufo-y w)))

(check-expect (move-all-on-tick world-test) 
              (make-world (make-posn 10 15) (list
                                             (make-cow (make-posn (+ 2 (/ SCREEN-WIDTH 2))
                                                                  (- SCREEN-HEIGHT HALF-COW-HEIGHT)) "right")
                                             (make-cow (make-posn (+ 2 (/ SCREEN-WIDTH 4))
                                                                  (- SCREEN-HEIGHT HALF-COW-HEIGHT))"right"))))

;move-cows : list-of-cows -> list-of-cows
;move-cows consumes a list-of-cows and produces a list of cows moved to the left or right depending on the cows' directions
(define (move-cows aloc)
  (cond
    [(empty? aloc) empty]
    [(cons? aloc) (cons
                   (make-cow
                    (make-posn
                     (
                      (cond
                        [(string=? (cow-dir (first aloc)) "right") +]
                        [(string=? (cow-dir (first aloc)) "left") -])
                      (posn-x (cow-p (first aloc))) COW-SPEED)
                     (posn-y (cow-p (first aloc))))
                    (cow-dir (first aloc))) 
                   (move-cows (rest aloc)))]))

(check-expect (move-cows empty) empty)
(check-expect (move-cows (list cow0)) (list (make-cow (make-posn (+ 2 (/ SCREEN-WIDTH 2)) (- SCREEN-HEIGHT HALF-COW-HEIGHT)) "right")))

;new-dirs : list-of-cows list-of-cows -> list-of-cows
;consumes two identical lists-of-cows and produces a list-of-cows in which all cows' dirs are updated
;e.g. changes the cow's direction if it collides with another cow or reaches the edge of the screen, otherwise leaves it unchanged
(define (new-dirs aloc1 aloc2)
  (cond
    [(empty? aloc1) empty]
    [(cons? aloc1) (cons (make-cow (cow-p (first aloc1))
                                   (update-dir (first aloc1) aloc2))
                         (new-dirs (rest aloc1) aloc2))]))

(check-expect (new-dirs empty empty) empty)
(check-expect (new-dirs (list cow0 cow1) (list cow0 cow1)) (list cow0 cow1))
(check-expect (new-dirs (list cow0 cow0) (list cow0 cow0)) (list
                                                            (make-cow (make-posn
                                                                       (/ SCREEN-WIDTH 2)
                                                                       (- SCREEN-HEIGHT HALF-COW-HEIGHT))
                                                                      "left")
                                                            (make-cow (make-posn
                                                                       (/ SCREEN-WIDTH 2)
                                                                       (- SCREEN-HEIGHT HALF-COW-HEIGHT))
                                                                      "left")))

;update-dir : cow list-of-cows -> String
;update-dir consumes a cow and a list-of-cows and changes it's direction if it hits a wall or another cow
(define (update-dir c aloc)
  (cond
    [(hitting-wall? (cow-p c) "right") "left"]
    [(hitting-wall? (cow-p c) "left") "right"]
    [(anything-touching-cow? (cow-p c) HALF-COW-WIDTH HALF-COW-HEIGHT (remove-cow-from-list c aloc))
     (cond
       [(string=? (cow-dir c) "left") "right"]
       [(string=? (cow-dir c) "right") "left"])]
    [else (cow-dir c)]))

(check-expect (update-dir cow0 (list cow0 cow1)) "right")
(check-expect (update-dir (make-cow (make-posn (+ SCREEN-WIDTH 5) 0) "right") (list cow0 cow1)) "left") 
(check-expect (update-dir (make-cow (make-posn -5 0) "left") (list cow0 cow1)) "right")
(check-expect (update-dir cow0 (list cow0 (make-cow (make-posn (/ SCREEN-WIDTH 2) (- SCREEN-HEIGHT HALF-COW-HEIGHT)) "left"))) "left")

;hitting-wall? : posn String -> boolean
;hitting-wall? consumes a posn and a direction and returns true if the posn is past the edge of the screen in that direction
;otherwise returns false
(define (hitting-wall? p dir)
  (cond
    [(string=? dir "right") (> (posn-x p) SCREEN-WIDTH)]
    [(string=? dir "left") (< (posn-x p) 0)]
    [(string=? dir "down") (> (posn-y p) SCREEN-HEIGHT)]))

(check-expect (hitting-wall? (make-posn -5 5) "left") true)
(check-expect (hitting-wall? (make-posn (+ SCREEN-WIDTH 5) 5) "right") true)
(check-expect (hitting-wall? (make-posn 5 (+ SCREEN-HEIGHT 5)) "down") true)
(check-expect (hitting-wall? (make-posn 5 5) "left") false)

;posn=? : posn posn -> boolean
;posn=? consumes two posns and returns true if they are equal, otherwise returns false
(define (posn=? p1 p2)
  (and
   (= (posn-x p1) (posn-x p2))
   (= (posn-y p1) (posn-y p2))))

(check-expect (posn=? (make-posn 5 5) (make-posn 5 5)) true)
(check-expect (posn=? (make-posn 5 5) (make-posn 10 10)) false)

;big-bang creates the world
(js-big-bang world0
             (to-draw draw)
             (on-key move-ufo-x)
             (on-tick move-all-on-tick)
             (stop-when ufo-done?))
