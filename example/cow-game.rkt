;Graphical Constants
(define COW-LEFT (bitmap/url "http://world.cs.brown.edu/1/clipart/cow-left.png"))
(define COW-RIGHT (bitmap/url "http://world.cs.brown.edu/1/clipart/cow-right.png"))
(define UFO (bitmap/url "http://world.cs.brown.edu/1/clipart/ufo.png"))
(define UFO-CAPTURE (bitmap/url "http://world.cs.brown.edu/1/clipart/ufo-capture.png"))


;Physical Constants
(define SCREEN-WIDTH 500)
(define SCREEN-HEIGHT 500)
(define BACKGROUND (empty-scene SCREEN-WIDTH SCREEN-HEIGHT))
(define UFO-HEIGHT (image-height UFO))
(define UFO-WIDTH (image-width UFO))
(define HALF-UFO-WIDTH (/ UFO-WIDTH 2))
(define HALF-UFO-HEIGHT (/ UFO-HEIGHT 2))
(define COW-HEIGHT (image-height COW-RIGHT))
(define COW-WIDTH (image-width COW-RIGHT))
(define HALF-COW-HEIGHT (/ COW-HEIGHT 2))
(define HALF-COW-WIDTH (/ COW-WIDTH 2))
(define COW-SPEED 2)
(define UFO-SPEED 5)

; A cow is a posn and a string
; p : posn  dir : string ("right" or "left")
; Represents a cow's position and the direction it faces
(define-struct cow (p dir))

; Define some sample cows
(define cow0 (make-cow (make-posn (/ SCREEN-WIDTH 2) (- SCREEN-HEIGHT HALF-COW-HEIGHT)) "right"))
(define cow1 (make-cow (make-posn (/ SCREEN-WIDTH 4) (- SCREEN-HEIGHT HALF-COW-HEIGHT)) "right"))
(define cow2 (make-cow (make-posn (* SCREEN-WIDTH 3/4) (- SCREEN-HEIGHT HALF-COW-HEIGHT)) "left"))

; A world is a posn and a list-of-cows
; ufo: posn  cows: list-of-cows
; Represents the ufo's position and all the cows' positions directions
(define-struct world (ufo cows))

; Define some sample worlds
(define world-test (make-world (make-posn 10 10)
                               (list cow0 cow1)))
(define world0 (make-world (make-posn (/ SCREEN-WIDTH 2) HALF-UFO-HEIGHT)
                           (list cow0 cow1 cow2)))

; draw-cows: list-of-cows scene -> scene
; draw-cows consumes a list-of-cows and a scene and produces a scene with cows at their posns
; given: a list of three cows (facing "right", "right", and "left")
; should produce: three cows drawn on a scene facing those directions at the bottom of the screen
; given: empty
; should produce: empty scene
(define (draw-cows aloc scene)
  (if (empty? aloc) scene
    (place-image (if (string=? (cow-dir (first aloc)) "right") COW-RIGHT
                     COW-LEFT)
                               (posn-x (cow-p (first aloc)))
                               (posn-y (cow-p (first aloc)))
                               (draw-cows (rest aloc) scene))))



; draw-ufo: posn scene img -> scene
; draw-ufo consumes a posn, a scene, and an img and produces a scene with a ufo drawn on the screen at the posn
; given: (make-posn 0 0) (empty-scene 500 500) UFO
; should produce: the UFO appearing on a scene at the top left corner
(define (draw-ufo p scene ufo-img)
  (place-image ufo-img (posn-x p) (posn-y p) scene))

; draw: world -> scene
; draw consumes a world and produces a scene with all the images
; given: world-test
; should produce: a ufo starting in the middle and three cows drawn on the background. The ufo should move left or right
; depending on whether left or right is pressed on the keyboard, respectively, if the ufo isn't hitting a left or right wall.
; Two cows start facing right, and one faces left. If a cow collides with another cow, both should change direction. If a cow
; runs into a wall, it should change direction. If the ufo hits a cow, it should change images to the ufo captured image.
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

; Test for move-ufo-y, which preserves the cow positions but drops the ufo
(check-expect (move-ufo-y world-test) (make-world (make-posn 10 15)
                                                  (list cow0 cow1)))

; move-ufo-x: world key -> world
; move-ufo-x consumes a world and key and produces a world with the ufo moved by keys
(define (move-ufo-x w key)
  (make-world 
   (make-posn  
    (if (and (key=? key "left") (not (hitting-wall? (world-ufo w) "left")))
      (- (posn-x (world-ufo w)) UFO-SPEED)
      (if (and (key=? key "right") (not (hitting-wall? (world-ufo w) "right")))
        (+ (posn-x (world-ufo w)) UFO-SPEED)
        (posn-x (world-ufo w))))
    (posn-y (world-ufo w)))
   (world-cows w)))

; left key pressed
(check-expect (move-ufo-x world-test "left") (make-world (make-posn 5 10) 
                                                         (list cow0 cow1)))
; right key pressed
(check-expect (move-ufo-x world-test "right") (make-world (make-posn 15 10) 
                                                          (list cow0 cow1)))
; any other key pressed                                                          
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

; ufo is not done 
(check-expect (ufo-done? world-test) false)
; ufo is touch a cow
(check-expect (ufo-done? (make-world (make-posn 20 (- SCREEN-HEIGHT 20)) (list (make-cow
                                                                                (make-posn 20 (- SCREEN-HEIGHT 20))
                                                                                "right"))))
              true)
; ufo is on the ground
(check-expect (ufo-done? (make-world (make-posn 0 (+ SCREEN-HEIGHT 5)) empty)) true)

;anything-touching-cow? : posn num num list-of-posns -> boolean
;anything-touching-cow? consumes a posn, an image height, an image width, and a list-of-cows and returns true if the image at the posns is touching any of the cows in the list based on the image height and width, otherwise returns false
(define (anything-touching-cow? img-p img-w img-h aloc)
  (if (empty? aloc) false
     (or 
      (and
       (or
        (and (>= (- (posn-x img-p) img-w) (- (posn-x (cow-p (first aloc))) HALF-COW-WIDTH))
             (<= (- (posn-x img-p) img-w) (+ (posn-x (cow-p (first aloc))) HALF-COW-WIDTH)))
        (and (>= (+ (posn-x img-p) img-w) (- (posn-x (cow-p (first aloc))) HALF-COW-WIDTH))
             (<= (+ (posn-x img-p) img-w) (+ (posn-x (cow-p (first aloc))) HALF-COW-WIDTH))))
       (>= (+ (posn-y img-p) img-h) (- (posn-y (cow-p (first aloc))) HALF-COW-HEIGHT)))
      (anything-touching-cow? img-p img-w img-h (rest aloc)))))

; there are no cows, so nothing is touching
(check-expect (anything-touching-cow? (make-posn 0 0) 0 0 empty) false)
; there is a cow, but it's not touching anything
(check-expect (anything-touching-cow? (make-posn (/ SCREEN-WIDTH 2) 20) 
                                      HALF-UFO-WIDTH 
                                      HALF-UFO-HEIGHT 
                                      (list cow0))
              false)
; this is a cow, and something is touching it
(check-expect (anything-touching-cow? (make-posn (/ SCREEN-WIDTH 2) (- SCREEN-HEIGHT HALF-COW-HEIGHT)) 
                                      HALF-UFO-WIDTH 
                                      HALF-UFO-HEIGHT 
                                      (list cow0))
              true)

;remove-cow-from-list : cow list-of-cows -> list-of-cows
;remove-cow-from-list consumes a cow and a list-of-cows and returns a list-of-cows with cow removed
(define (remove-cow-from-list c aloc)
  (if (empty? aloc) empty
    (if (posn=? (cow-p c) (cow-p (first aloc))) (rest aloc)
        (cons (first aloc) (remove-cow-from-list c (rest aloc))))))

; removing a cow from an empty list should still return empty
(check-expect (remove-cow-from-list cow0 empty) empty)
; removing a cow from a list should return a list with the other cows
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
  (if (empty? aloc) empty
    (cons
       (make-cow
        (make-posn
         (
          (if (string=? (cow-dir (first aloc)) "right") + -)
          (posn-x (cow-p (first aloc))) COW-SPEED)
         (posn-y (cow-p (first aloc))))
        (cow-dir (first aloc))) 
       (move-cows (rest aloc)))))

; moving cows in an empty list should still return empty
(check-expect (move-cows empty) empty)
; moving cows in a list should produce a list with those same cows, moved
(check-expect (move-cows (list cow0)) (list (make-cow (make-posn (+ 2 (/ SCREEN-WIDTH 2)) (- SCREEN-HEIGHT HALF-COW-HEIGHT)) "right")))

;new-dirs : list-of-cows list-of-cows -> list-of-cows
;consumes two identical lists-of-cows and produces a list-of-cows in which all cows' dirs are updated
;e.g. changes the cow's direction if it collides with another cow or reaches the edge of the screen, otherwise leaves it unchanged
(define (new-dirs aloc1 aloc2)
  (if (empty? aloc1) empty
    (cons (make-cow (cow-p (first aloc1))
                                   (update-dir (first aloc1) aloc2))
                         (new-dirs (rest aloc1) aloc2))))

; changing direction on an empty list should still return empty
(check-expect (new-dirs empty empty) empty)
; changing direction of non-colliding cows should return the same list, unchanged
(check-expect (new-dirs (list cow0 cow1) (list cow0 cow1)) (list cow0 cow1))
; changing direction of cows that collided should make them both change direction
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
  (if (hitting-wall? (cow-p c) "right") 
    "left"
    (if (hitting-wall? (cow-p c) "left") 
      "right"
      (if (anything-touching-cow? (cow-p c) HALF-COW-WIDTH HALF-COW-HEIGHT (remove-cow-from-list c aloc))
        (if (string=? (cow-dir c) "left") 
          "right"
          "left")
        (cow-dir c)))))

; test condition for changing to right when hitting another cow
(check-expect (update-dir cow0 (list cow0 cow1)) "right")
; test condition for changing to left when hitting another cow
(check-expect (update-dir (make-cow (make-posn (+ SCREEN-WIDTH 5) 0) "right") (list cow0 cow1)) "left") 
; test condition for changing to right when hitting a wall
(check-expect (update-dir (make-cow (make-posn -5 0) "left") (list cow0 cow1)) "right")
; test condition for changing to left when hitting a wall
(check-expect (update-dir cow0 (list cow0 (make-cow (make-posn (/ SCREEN-WIDTH 2) (- SCREEN-HEIGHT HALF-COW-HEIGHT)) "left"))) "left")

;hitting-wall? : posn String -> boolean
;hitting-wall? consumes a posn and a direction and returns true if the posn is past the edge of the screen in that direction
;otherwise returns false
(define (hitting-wall? p dir)
  (if (string=? dir "right") 
    (> (posn-x p) SCREEN-WIDTH)
    (if (string=? dir "left") 
      (< (posn-x p) 0)
      (> (posn-y p) SCREEN-HEIGHT))))

; test for hitting the left wall
(check-expect (hitting-wall? (make-posn -5 5) "left") true)
; test for hitting the right wall
(check-expect (hitting-wall? (make-posn (+ SCREEN-WIDTH 5) 5) "right") true)
; test for hitting the bottom wall
(check-expect (hitting-wall? (make-posn 5 (+ SCREEN-HEIGHT 5)) "down") true)
; test for not hitting anything
(check-expect (hitting-wall? (make-posn 5 5) "left") false)

;posn=? : posn posn -> boolean
;posn=? consumes two posns and returns true if they are equal, otherwise returns false
(define (posn=? p1 p2)
  (and
   (= (posn-x p1) (posn-x p2))
   (= (posn-y p1) (posn-y p2))))

; test for two identical posns
(check-expect (posn=? (make-posn 5 5) (make-posn 5 5)) true)
; test for two different posns
(check-expect (posn=? (make-posn 5 5) (make-posn 10 10)) false)

;big-bang creates the world, binds handlers for draw, key, and tick events, and starts the game
(big-bang world0
             (to-draw draw)
             (on-key move-ufo-x)
             (on-tick move-all-on-tick)
             (stop-when ufo-done?))