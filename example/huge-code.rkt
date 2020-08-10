(define CAVEMAN
  (scale
   1/8
   (bitmap/url
    "http://1.bp.blogspot.com/-Db9jjPtxrsc/TtqrFL2UUcI/AAAAAAAAAcw/zL5nubGnwyE/s1600/caveman.png")))
(define GOLD
  (scale
   1/5
   (bitmap/url
    "http://www.farmvillefreak.com/farmville_images/facebook_farmville_Freak_golden_coin_icon.png")))
(define DOOR
  (bitmap/url
   "http://www.hscripts.com/freeimages/icons/furniture/door/door-clipart-picture8.gif"))
(define CAVERN
  (scale
   1/2
   (bitmap/url
    "http://upload.wikimedia.org/wikipedia/commons/7/70/Large_cavern_with_lots_of_features.jpg")))
(define KEY
  (scale
   1/20
   (bitmap/url
    "http://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Crypto_key.svg/671px-Crypto_key.svg.png")))
(define LADDER
  (scale/xy 1/4 1 (bitmap/url "http://www.shalfleet.net/advent/ladder.gif")))
(define BAT (triangle 50 "solid" "red"))
(define RAM
  (scale
   2/3
   (bitmap/url "http://netanimations.net/Ram-running-left-gif-animation.gif")))
(define ALIEN (scale 1/2 (bitmap/url "http://netanimations.net/alien_62.gif")))
(define SKY
  (bitmap/url
   "http://4.bp.blogspot.com/-yAOYE3-J1mo/TmsnBJ6ucYI/AAAAAAAABcA/5ZKqEv3p-6I/s1600/36676-sky_blue.jpg"))
(define GUY
  (scale
   2/3
   (bitmap/url
    "http://www.gifs.net/Animation11/Jobs_and_People/Babies/baby_walking.gif")))
(define FIRE BAT)
(define DRAGON2 (circle 50 "solid" "red"))
(define DRAGON
  (scale
   1/2
   (bitmap/url "http://img.photobucket.com/albums/v320/VALKYRIA/Dragon.gif")))
(define PIG
  (scale
   1/2
   (bitmap/url
    "http://netanimations.net/Moving-animated-picture-of-pig-in-a-suit-tips-hat.gif")))
(define END
  (put-image
   (rotate 30 (text "You won! DEVOLUTION" 100 "red"))
   512
   410
   (rectangle 1024 819 "solid" "black")))


(define (moveBAT time enemy)
  (make-enemy
   (enemy-image enemy)
   (enemy-eX enemy)
   (cond
     [(> (enemy-eY enemy) 780) -20]
     [else (+ 2 (enemy-eY enemy))])
   (enemy-move enemy)))

(define (moveRAM time enemy)
  (make-enemy
   (enemy-image enemy)
   (cond
     [(< (enemy-eX enemy) -1000) 2050]
     [else (- (enemy-eX enemy) 15)])
   (enemy-eY enemy)
   (enemy-move enemy)))

(define (moveALIEN time enemy)
  (make-enemy
   (enemy-image enemy)
   800
   (cond
     [(> (enemy-eY enemy) 800) -50]
     [else (+ (enemy-eY enemy) 5)])
   (enemy-move enemy)))

(define (moveDRAGON1 time enemy)
  (make-enemy
   (enemy-image enemy)
   (cond
     [(< (enemy-eX enemy) -30) 1050]
     [else (- (enemy-eX enemy) 10)])
   350
   (enemy-move enemy)))

(define (moveDRAGON2 time enemy)
  (cond
    [(> time 300)
     (make-enemy
      (enemy-image enemy)
      (cond
        [(> (enemy-eX enemy) 1050) -30]
        [else (+ (enemy-eX enemy) 12)])
      (cond
        [(> (enemy-eX enemy) 1050) 850]
        [else (- (enemy-eY enemy) 8)])
      (enemy-move enemy))]
    [else enemy]))

(define (moveDRAGON3 time enemy)
  (cond
    [(> time 550)
     (make-enemy
      (enemy-image enemy)
      (cond
        [(> (enemy-eX enemy) 1050) -50]
        [else (+ (enemy-eX enemy) 10)])
      (+ (* 390 (cos (/ time 20))) 410)
      (enemy-move enemy))]
    [else enemy]))

(define LEVEL1
  (put-image
   (rectangle 500 20 "solid" "brown")
   250
   31
   (put-image
    (rectangle 70 20 "solid" "brown")
    700
    31
    (put-image
     (rectangle 100 20 "solid" "brown")
     974
     31
     (put-image
      (rectangle 650 20 "solid" "brown")
      325
      280
      (put-image
       (rectangle 650 20 "solid" "brown")
       325
       560
       (put-image
        (rectangle 150 20 "solid" "brown")
        949
        560
        (put-image LADDER 340 162 (put-image LADDER 600 425 CAVERN)))))))))
(define LEVEL2
  (put-image
   (rectangle 500 20 "solid" "brown")
   250
   31
   (put-image
    (rectangle 70 20 "solid" "brown")
    700
    31
    (put-image
     (rectangle 100 20 "solid" "brown")
     974
     31
     (put-image
      (rectangle 650 20 "solid" "brown")
      325
      280
      (put-image
       (rectangle 650 20 "solid" "brown")
       325
       560
       (put-image
        (rectangle 150 20 "solid" "brown")
        949
        560
        (put-image LADDER 340 162 (put-image LADDER 600 425 SKY)))))))))

(define LEVEL3
  (put-image
   (rectangle 500 20 "solid" "brown")
   250
   31
   (put-image
    (rectangle 70 20 "solid" "brown")
    700
    31
    (put-image
     (rectangle 100 20 "solid" "brown")
     974
     31
     (put-image
      (rectangle 650 20 "solid" "brown")
      325
      280
      (put-image
       (rectangle 650 20 "solid" "brown")
       325
       560
       (put-image
        (rectangle 150 20 "solid" "brown")
        949
        560
        (put-image LADDER 340 162 (put-image LADDER 600 425 FIRE)))))))))

(define (distance x1 y1 x2 y2) (sqrt (+ (sqr (- x1 x2)) (sqr (- y1 y2)))))

(define (on-floor world)
  (cond
    [(image=? (level-background (world-level world)) LEVEL1)
     (or
      (and
       (>= (world-cX world) 15)
       (<= (world-cX world) 500)
       (= (world-cY world) 69))
      (and
       (>= (world-cX world) 665)
       (<= (world-cX world) 735)
       (= (world-cY world) 69))
      (and
       (>= (world-cX world) 924)
       (<= (world-cX world) 1009)
       (= (world-cY world) 69))
      (and
       (>= (world-cX world) 15)
       (<= (world-cX world) 650)
       (= (world-cY world) 319))
      (and
       (>= (world-cX world) 15)
       (<= (world-cX world) 650)
       (= (world-cY world) 599))
      (and
       (>= (world-cX world) 874)
       (<= (world-cX world) 1009)
       (= (world-cY world) 599)))]
    [(image=? (level-background (world-level world)) LEVEL2)
     (or
      (and
       (>= (world-cX world) 15)
       (<= (world-cX world) 500)
       (= (world-cY world) 69))
      (and
       (>= (world-cX world) 665)
       (<= (world-cX world) 735)
       (= (world-cY world) 69))
      (and
       (>= (world-cX world) 924)
       (<= (world-cX world) 1009)
       (= (world-cY world) 69))
      (and
       (>= (world-cX world) 15)
       (<= (world-cX world) 650)
       (= (world-cY world) 319))
      (and
       (>= (world-cX world) 15)
       (<= (world-cX world) 650)
       (= (world-cY world) 599))
      (and
       (>= (world-cX world) 874)
       (<= (world-cX world) 1009)
       (= (world-cY world) 599)))]
    [(image=? (level-background (world-level world)) LEVEL3)
     (or
      (and
       (>= (world-cX world) 15)
       (<= (world-cX world) 500)
       (= (world-cY world) 69))
      (and
       (>= (world-cX world) 665)
       (<= (world-cX world) 735)
       (= (world-cY world) 69))
      (and
       (>= (world-cX world) 924)
       (<= (world-cX world) 1009)
       (= (world-cY world) 69))
      (and
       (>= (world-cX world) 15)
       (<= (world-cX world) 650)
       (= (world-cY world) 319))
      (and
       (>= (world-cX world) 15)
       (<= (world-cX world) 650)
       (= (world-cY world) 599))
      (and
       (>= (world-cX world) 874)
       (<= (world-cX world) 1009)
       (= (world-cY world) 599)))]))

(define (on-ladder world)
  (cond
    [(image=? (level-background (world-level world)) LEVEL1)
     (or
      (and
       (>= (world-cX world) 315)
       (<= (world-cX world) 365)
       (>= (world-cY world) 69)
       (<= (world-cY world) 319))
      (and
       (>= (world-cX world) 575)
       (<= (world-cX world) 625)
       (>= (world-cY world) 319)
       (<= (world-cY world) 599)))]
    [(image=? (level-background (world-level world)) LEVEL2)
     (or
      (and
       (>= (world-cX world) 315)
       (<= (world-cX world) 365)
       (>= (world-cY world) 69)
       (<= (world-cY world) 319))
      (and
       (>= (world-cX world) 575)
       (<= (world-cX world) 625)
       (>= (world-cY world) 319)
       (<= (world-cY world) 599)))]
    [(image=? (level-background (world-level world)) LEVEL3)
     (or
      (and
       (>= (world-cX world) 315)
       (<= (world-cX world) 365)
       (>= (world-cY world) 69)
       (<= (world-cY world) 319))
      (and
       (>= (world-cX world) 575)
       (<= (world-cX world) 625)
       (>= (world-cY world) 319)
       (<= (world-cY world) 599)))]))

(define (ladder-down world)
  (cond
    [(image=? (level-background (world-level world)) LEVEL1)
     (or
      (and
       (>= (world-cX world) 315)
       (<= (world-cX world) 365)
       (>= (world-cY world) 79)
       (<= (world-cY world) 319))
      (and
       (>= (world-cX world) 575)
       (<= (world-cX world) 625)
       (>= (world-cY world) 329)
       (<= (world-cY world) 599)))]
    [(image=? (level-background (world-level world)) LEVEL2)
     (or
      (and
       (>= (world-cX world) 315)
       (<= (world-cX world) 365)
       (>= (world-cY world) 79)
       (<= (world-cY world) 319))
      (and
       (>= (world-cX world) 575)
       (<= (world-cX world) 625)
       (>= (world-cY world) 329)
       (<= (world-cY world) 599)))]
    [(image=? (level-background (world-level world)) LEVEL3)
     (or
      (and
       (>= (world-cX world) 315)
       (<= (world-cX world) 365)
       (>= (world-cY world) 79)
       (<= (world-cY world) 319))
      (and
       (>= (world-cX world) 575)
       (<= (world-cX world) 625)
       (>= (world-cY world) 329)
       (<= (world-cY world) 599)))]))


(define-struct world (level cX cY gold key time))
(define-struct enemy (image eX eY move))


(define-struct level (character background gX gY kX kY dX dY badguys))


(define level1
  (make-world
   (make-level
    CAVEMAN
    LEVEL1
    980
    58
    960
    590
    19
    607
    (list (make-enemy BAT 930 50 moveBAT)))
   50
   69
   0
   0
   0))
(define level2
  (make-world
   (make-level
    GUY
    LEVEL2
    55
    58
    960
    60
    19
    607
    (list (make-enemy RAM 1050 70 moveRAM) (make-enemy ALIEN 700 150 moveALIEN)))
   50
   599
   0
   0
   0))

(define level3
  (make-world
   (make-level
    PIG
    LEVEL3
    30
    607
    980
    58
    19
    77
    (list
     (make-enemy DRAGON 1000 350 moveDRAGON1)
     (make-enemy DRAGON2 -200 920 moveDRAGON2)
     (make-enemy DRAGON -100 400 moveDRAGON3)))
   50
   69
   0
   0
   0))















(define (draw-badguys enemies level)
  (cond
    [(empty? enemies) (level-background level)]
    [else
     (put-image
      (enemy-image (first enemies))
      (enemy-eX (first enemies))
      (enemy-eY (first enemies))
      (draw-badguys (rest enemies) level))]))

(define (draw-world world)
  (put-image
   (level-character (world-level world))
   (world-cX world)
   (world-cY world)
   (put-image
    (rectangle (- 1024 (/ (world-time world) 6/5)) 20 "solid" "red")
    (/ (- 1024 (/ (world-time world) 6/5)) 2)
    745
    (put-image
     DOOR
     (level-dX (world-level world))
     (level-dY (world-level world))
     (cond
       [(and (= (world-gold world) 1) (= (world-key world) 0))
        (put-image
         KEY
         (level-kX (world-level world))
         (level-kY (world-level world))
         (draw-badguys (level-badguys (world-level world)) (world-level world)))]
       [(and (= (world-gold world) 1) (= (world-key world) 1))
        (draw-badguys (level-badguys (world-level world)) (world-level world))]
       [else
        (put-image
         GOLD
         (level-gX (world-level world))
         (level-gY (world-level world))
         (draw-badguys (level-badguys (world-level world)) (world-level world)))])))))






(define (update-enemy time enemies)
  (cond
    [(empty? enemies) empty]
    [else
     (cons
      ((enemy-move (first enemies)) time (first enemies))
      (update-enemy time (rest enemies)))]))

(define (badguys-collision world)
  (cond
    [(empty? (level-badguys (world-level world))) false]
    [else
     (cond
       [(and
         (<
          (distance
           (world-cX world)
           (world-cY world)
           (enemy-eX (first (level-badguys (world-level world))))
           (enemy-eY (first (level-badguys (world-level world)))))
          80)
         (not
          (image=?
           (enemy-image (first (level-badguys (world-level world))))
           ALIEN))
         (not
          (image=?
           (enemy-image (first (level-badguys (world-level world))))
           DRAGON2)))
        true]
       [else
        (badguys-collision
         (make-world
          (make-level
           (level-character (world-level world))
           (level-background (world-level world))
           (level-gX (world-level world))
           (level-gY (world-level world))
           (level-kX (world-level world))
           (level-kY (world-level world))
           (level-dX (world-level world))
           (level-dY (world-level world))
           (rest (level-badguys (world-level world))))
          (world-cX world)
          (world-cY world)
          (world-gold world)
          (world-key world)
          (world-time world)))])]))

(define (game-over world)
  (or
   (< (world-cY world) -20)
   (badguys-collision world)
   (and
    (> (world-time world) 1229)
    (or
     (>
      (distance
       (world-cX world)
       (world-cY world)
       (level-dX (world-level world))
       (level-dY (world-level world)))
      20)
     (= (world-key world) 0)))))

(define (update-world world)
  (cond
    [(and
      (<
       (distance
        (world-cX world)
        (world-cY world)
        (level-dX (world-level world))
        (level-dY (world-level world)))
       20)
      (= (world-key world) 1)
      (image=? (level-background (world-level world)) LEVEL1))
     level2]
    [(and
      (<
       (distance
        (world-cX world)
        (world-cY world)
        (level-dX (world-level world))
        (level-dY (world-level world)))
       20)
      (= (world-key world) 1)
      (image=? (level-background (world-level world)) LEVEL2))
     level3]
    [(and
      (<
       (distance
        (world-cX world)
        (world-cY world)
        (level-dX (world-level world))
        (level-dY (world-level world)))
       20)
      (= (world-key world) 1)
      (image=? (level-background (world-level world)) LEVEL3))
     (make-world
      (make-level PIG END -50 -50 -50 -50 -50 -50 empty)
      -50
      -50
      0
      0
      0)]
    [(game-over world) level1]
    [else
     (make-world
      (make-level
       (level-character (world-level world))
       (level-background (world-level world))
       (level-gX (world-level world))
       (level-gY (world-level world))
       (level-kX (world-level world))
       (level-kY (world-level world))
       (level-dX (world-level world))
       (level-dY (world-level world))
       (update-enemy (world-time world) (level-badguys (world-level world))))
      (world-cX world)
      (cond
        [(or (on-ladder world) (on-floor world)) (world-cY world)]
        [else (- (world-cY world) 5)])
      (cond
        [(<
          (distance
           (world-cX world)
           (world-cY world)
           (level-gX (world-level world))
           (level-gY (world-level world)))
          15)
         1]
        [(and
          (> (length (level-badguys (world-level world))) 1)
          (<
           (distance
            (world-cX world)
            (world-cY world)
            (enemy-eX (second (level-badguys (world-level world))))
            (enemy-eY (second (level-badguys (world-level world)))))
           80))
         0]
        [else (world-gold world)])
      (cond
        [(<
          (distance
           (world-cX world)
           (world-cY world)
           (level-kX (world-level world))
           (level-kY (world-level world)))
          30)
         1]
        [(and
          (> (length (level-badguys (world-level world))) 1)
          (<
           (distance
            (world-cX world)
            (world-cY world)
            (enemy-eX (second (level-badguys (world-level world))))
            (enemy-eY (second (level-badguys (world-level world)))))
           80))
         0]
        [else (world-key world)])
      (+ 1 (world-time world)))]))











(EXAMPLE
 (keypress level1 "right")
 (make-world
  (world-level level1)
  (+ (world-cX level1) 10)
  (world-cY level1)
  (world-gold level1)
  (world-key level1)
  (world-time level1)))
(EXAMPLE
 (keypress level1 "left")
 (make-world
  (world-level level1)
  (- (world-cX level1) 10)
  (world-cY level1)
  (world-gold level1)
  (world-key level1)
  (world-time level1)))
(EXAMPLE
 (keypress level1 "up")
 (cond
   [(on-ladder level1)
    (make-world
     (world-level level1)
     (world-cX level1)
     (+ (world-cY level1) 10)
     (world-gold level1)
     (world-key level1)
     (world-time level1))]
   [else level1]))
(EXAMPLE
 (keypress level1 "down")
 (cond
   [(ladder-down level1)
    (make-world
     (world-level level1)
     (world-cX level1)
     (- (world-cY level1) 10)
     (world-gold level1)
     (world-key level1)
     (world-time level1))]
   [else level1]))

(define (keypress world key)
  (cond
    [(string=? key "right")
     (cond
       [(and (>= (world-cX world) 15) (<= (world-cX world) 999))
        (make-world
         (world-level world)
         (+ (world-cX world) 10)
         (world-cY world)
         (world-gold world)
         (world-key world)
         (world-time world))]
       [else world])]
    [(string=? key "left")
     (cond
       [(and (>= (world-cX world) 25) (<= (world-cX world) 1009))
        (make-world
         (world-level world)
         (- (world-cX world) 10)
         (world-cY world)
         (world-gold world)
         (world-key world)
         (world-time world))]
       [else world])]
    [(string=? key "up")
     (cond
       [(on-ladder world)
        (make-world
         (world-level world)
         (world-cX world)
         (+ (world-cY world) 10)
         (world-gold world)
         (world-key world)
         (world-time world))]
       [else world])]
    [(string=? key "down")
     (cond
       [(ladder-down world)
        (make-world
         (world-level world)
         (world-cX world)
         (- (world-cY world) 10)
         (world-gold world)
         (world-key world)
         (world-time world))]
       [else world])]
    [(string=? key "z")
     (cond
       [(on-floor world)
        (make-world
         (world-level world)
         (- (world-cX world) 200)
         (+ (world-cY world) 200)
         (world-gold world)
         (world-key world)
         (world-time world))]
       [else world])]
    [(string=? key "x")
     (cond
       [(on-floor world)
        (make-world
         (world-level world)
         (+ (world-cX world) 200)
         (+ (world-cY world) 200)
         (world-gold world)
         (world-key world)
         (world-time world))]
       [else world])]
    [else world]))





(big-bang level1 (on-tick update-world) (on-redraw draw-world) (on-key keypress))