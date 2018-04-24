;Space Invaders!

;Things:
;  - a bunch of aliens that move down the screen
;  - a spaceship that moves back and forth across the bottom of the screen
;  - bullets that move up from the spaceship

;Things that happen all the time:
;  - sometimes a new alien appears at the top of the screen
;  - all aliens move down
;  - all bullets move up
;  - if a bullet hits an alien, the alien and the bullet go away
;  - if an alien gets to the bottom, it's game-over

;Things that happen when the player does something:
;  - when the mouse moves, have the ship move with it
;  - when the user clicks the mouse, have it create a bullet

;A Fleet is a ListofPosns, representng the positions of all the aliens

;A Barrage is a ListofPosns, representing the positions of all the bullets

;A Ship is a Number, representing the x-coordinate of the spaceship

;A ListofPosns (LoP) is one of:
;  - empty
;  - (cons (make-posn Number Number) ListofPosns)

;Some constants
(define WIDTH 600)
(define HEIGHT 400)
(define ALIEN-SIZE 20)
(define CHANCE-OF-ALIEN 3)  ;as a percentage
(define SHOT-SPEED 10)
(define ALIEN-SPEED 1)
(define SHIP-IMG (triangle 10 "outline" "black"))
(define SHOT-IMG (rectangle 3 10 "solid" "orange"))
(define ALIEN-IMG (star ALIEN-SIZE "solid" "green"))

;The state is represented by a World, which contains the player, a list of shots fired, and a list of aliens
(define-struct world [player shots aliens])

;Some example worlds we can use for testing
(define example-world (make-world 150 
                                  (list (make-posn 150 350) (make-posn 51 23))
                                  (list (make-posn 50 25) (make-posn 150 100))))
(define example-world+1 (make-world 150 
                                  (list (make-posn 150 (- 350 SHOT-SPEED)) 
                                        (make-posn 51 (- 23 SHOT-SPEED)))
                                  (list (make-posn 150 (+ 100 ALIEN-SPEED)))))


; render: World -> Image
;  to draw the world
(define (render w)
  (render-ship (world-player w)
          (render-fleet (world-aliens w)
                        (render-barrage (world-shots w)
                                        (empty-scene WIDTH HEIGHT)))))
; test case for rendering the example world
(check-expect (render example-world) 
              (place-image SHIP-IMG 150 (- HEIGHT 10)
                           (place-image ALIEN-IMG 50 25
                                        (place-image ALIEN-IMG 150 100
                                                     (place-image SHOT-IMG 150 350
                                                                  (place-image SHOT-IMG 51 23
                                                                               (empty-scene
                                                                                WIDTH HEIGHT)))))))

;  render-ship: Ship Image -> Image
;  to draw a ship onto a given scene
(define (render-ship ship-x scene)
  (place-image SHIP-IMG ship-x (- HEIGHT 10) scene))
; test case for rendering a ship
(check-expect (render-ship 150 (empty-scene WIDTH HEIGHT))
              (place-image SHIP-IMG 150 (- HEIGHT 10) (empty-scene WIDTH HEIGHT)))

;  render-barrage: Barrage Image -> Image
;  recursively draw bullets onto the rest of the scene
(define (render-barrage los scene)
  (cond
    [(empty? los) scene]
    [(cons? los) (place-image SHOT-IMG (posn-x (first los)) (posn-y (first los))
                              (render-barrage (rest los) scene))]))
; test case for rendering a barrage
(check-expect (render-barrage (list (make-posn 150 350) (make-posn 51 23)) 
                              (empty-scene WIDTH HEIGHT))
              (place-image SHOT-IMG 150 350
                           (place-image SHOT-IMG 51 23
                                        (empty-scene WIDTH HEIGHT))))

; render-fleet: Aliens Scene -> Image
; render a list of aliens by recursively adding them to the scene
(define (render-fleet loa scene)
  (cond
    [(empty? loa) scene]
    [(cons? loa) (place-image ALIEN-IMG (posn-x (first loa)) (posn-y (first loa))
                              (render-fleet (rest loa) scene))]))

;tick: World -> World
;  move everything that needs moving, add what needs adding, and remove what nees removing
;  NOTE: Since the add-alien function only sometimes (at random) adds an alien, we can't use check-expect
;  to test it.
(define (tick w)
  (make-world (world-player w)
              (move-barrage (world-shots w))
              (add-alien (move-fleet (remove-aliens (world-aliens w) (world-shots w))))))

; move-fleet: Fleet -> Fleet
; recursively move the aliens 
(define (move-fleet loa)
  (cond
   [(empty? loa) empty]
   [(cons? loa) (cons (make-posn (posn-x (first loa)) (+ ALIEN-SPEED (posn-y (first loa))))
                      (move-fleet (rest loa)))]))
; test for a simple list of two aliens
(check-expect (move-fleet (list (make-posn 50 100) (make-posn 10 350))) 
              (list (make-posn 50 (+ 100 ALIEN-SPEED)) (make-posn 10 (+ 350 ALIEN-SPEED))))

;  move-barrage: Barrage -> Barrage
;  recursively move the bullets up
(define (move-barrage los)
  (cond
   [(empty? los) empty]
   [(cons? los) (cons (make-posn (posn-x (first los)) (- (posn-y (first los)) SHOT-SPEED))
                      (move-barrage (rest los)))]))
; test for a list of two bullets
(check-expect (move-barrage (list (make-posn 50 100) (make-posn 10 350))) 
              (list (make-posn 50 (- 100 SHOT-SPEED)) (make-posn 10 (- 350 SHOT-SPEED))))

;  remove-aliens: Fleet Barrage -> Fleet
;  recursively remove any aliens that were hit by bullets
(define (remove-aliens loa los)
  (cond
    [(empty? loa) empty]
    [(cons? loa) (cond
                   [(near-any? (first loa) los) (remove-aliens (rest loa) los)]
                   [else (cons (first loa) (remove-aliens (rest loa) los))])]))
; test where one of two aliens is removed, and the other remains
(check-expect (remove-aliens (list (make-posn 50 100) (make-posn 10 350)) 
                             (list (make-posn 8 349) (make-posn 289 77)))
              (list (make-posn 50 100)))

;  near-any?: Posn Barrage -> Boolean
;  determines if the given posn is near any of the posns in the given shots
(define (near-any? alien los)
  (cond
    [(empty? los) false]
    [(cons? los) (or (near? alien (first los)) (near-any? alien (rest los)))]))
(check-expect (near-any? (make-posn 8 349) (list (make-posn 50 100) (make-posn 10 350))) true)
(check-expect (near-any? (make-posn 108 349) (list (make-posn 50 100) (make-posn 10 350))) false)

; near?: Posn Posn -> Boolean
; determines whether the two given posns are close enough together
(define (near? bullet alien)
  (cond
    [(<= (distance bullet alien) ALIEN-SIZE) true]
    [else false]))
; test where the posns are near
(check-expect (near? (make-posn 50 25) (make-posn 51 24)) true)
; test where the posns are far
(check-expect (near? (make-posn 50 25) (make-posn 151 24)) false)

; distance: Posn Posn -> Number
; determines the distance between two posns using the standard formula
(define (distance p1 p2)
  (sqrt (+ (sqr (- (posn-x p2) (posn-x p1))) 
           (sqr (- (posn-y p2) (posn-y p1))))))
; check the distance between two points (accounting for rounding error)
(check-within (distance (make-posn 0 0) (make-posn 1 1)) (sqrt 2) 0.001)

; add-alien: Fleet -> Fleet
; randomly add an alien with a random chance at a random horizontal position
(define (add-alien loa)
  (cond
    [(< (random 100) CHANCE-OF-ALIEN) (cons (make-posn (random WIDTH) 0) loa)]
    [else loa]))

; mouse: World Number Number MouseEvent -> World
; respond to mouse movement and clicking
(define (mouse w mx my me)
  (if (string=? me "move") 
    (make-world mx (world-shots w) (world-aliens w))
    (if (string=? me "button-down") 
      (make-world (world-player w) (add-bullet mx (world-shots w)) (world-aliens w))
      w)))
; test for clicking a button: add a bullet to the world at the mouse's x-coordinate      
(check-expect (mouse (make-world 150 empty empty) 150 250 "button-down") 
              (make-world 150 (list (make-posn 150 (- HEIGHT 10))) empty))

; add-bullet: Number Barrage -> Barrage
; add a fired bullet to the given barrage at the given x-coordinate
(define (add-bullet x los)
  (cons (make-posn x (- HEIGHT 10)) los))
(check-expect (add-bullet 200 (list (make-posn 50 150))) (list (make-posn 200 (- HEIGHT 10)) (make-posn 50 150)))

; game-over?: World -> Boolean
; decide if it's time to end the game
(define (game-over? w)
  (any-on-ground? (world-aliens w)))
; when one alien is on the ground, the game should be over
(check-expect (game-over? (make-world 100 empty 
                                      (list (make-posn 80 (+ HEIGHT 3)) (make-posn 88 65))))
              true)
; when no aliens are on the ground, the game should NOT be over
(check-expect (game-over? (make-world 100 empty 
                                      (list (make-posn 80 (- HEIGHT 100)) (make-posn 88 65))))
              false)

; any-on-ground?: Fleet -> Boolean
; decide if any of the given aliens are on the ground
(define (any-on-ground? loa)
  (cond
    [(empty? loa) false]
    [(cons? loa) (or (>= (posn-y (first loa)) (- HEIGHT ALIEN-SIZE)) 
                     (any-on-ground? (rest loa)))]))
; test for when one is on the ground
(check-expect (any-on-ground? (list (make-posn 80 (+ HEIGHT 3)) (make-posn 88 65))) true)
; test for when one is NOT on the ground
(check-expect (any-on-ground? (list (make-posn 80 (- HEIGHT 100)) (make-posn 88 65))) false)

; render-end: World -> Image
; display end of game message on top of current world rendering
(define (render-end w)
  (overlay (text "Game Over" 50 "black") (render w)))
(check-expect (render-end example-world) 
              (overlay (text "Game Over" 50 "black")
                       (render example-world)))

;big-bang creates the world, binds handlers for draw, mouse, and tick events, and starts the game
(big-bang (make-world (/ WIDTH 2) empty empty)
          [on-tick tick]
          [to-draw render]
          [on-mouse mouse]
          [stop-when game-over?])