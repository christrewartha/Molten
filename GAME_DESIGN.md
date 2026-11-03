# Molten – Game Description

## 1. About this document

This document is the source of truth for the game "Molten".

- Use this document to build the game on a different platform.
- Update this document when the game changes.
- If the code and this document do not agree, find the cause. Then correct the code or the document.

Status labels:

- **Decided** – The rule is agreed. Use it.
- **Proposed** – The rule is a suggestion. It can change.
- **Open** – No decision yet.

Values marked "(tunable)" are starting values. They will change during play testing. The current values are in `src/config.js`.

The language in this document is simplified technical English (based on ASD-STE100).

## 2. Summary

"Molten" is a vertical scrolling game for mobile devices. The player controls one object near the bottom of the screen. Shapes move toward the player. The player must avoid the shapes.

The player does not shoot. The game is a "bullet heaven" game: it uses the patterns of a shooter game, but the only action is to dodge.

The game has no levels. The difficulty increases slowly while the player stays alive.

The gameplay must be calm and easy to understand. The visual style is the most important part of the game.

### 2.1 Mood

- **Decided** – The mood of the game is very relaxed ("stoner chill"). All parts of the game must support this mood: gameplay, visuals, audio and menus.
- **Proposed** – Avoid loud, sudden or aggressive feedback. For example: no screen shake, no harsh flashes, no alarm sounds.
- **Proposed** – Text is lowercase, thin and widely spaced. Words are soft (for example: "you drifted for", "go again").

## 3. Gameplay

### 3.1 Play area

- **Decided** – The play area scrolls vertically. The shapes move from the top of the screen toward the bottom.
- **Decided** – The play area is in portrait orientation. The game is made for mobile devices.
- **Decided** – The play area has a fixed aspect ratio of 9:16 (width:height).
- **Decided** – The play area is 9 × 16 world units. The origin is at the centre. +Y is up.
- **Proposed** – On a screen with a different ratio, the game scales the play area to fit. It fills the remaining space with dark bars. The play area does not stretch.

### 3.2 Player

- **Decided** – The player controls one object.
- **Decided** – The player object can move. It cannot shoot.
- **Decided** – The player object is an oval blob of wax (see below). (Before 2026-10-11, it was a plain oval, marked as temporary.)
- **Proposed** – Oval radii: 0.3 units (horizontal), 0.42 units (vertical). (tunable)
- **Decided** – The player object looks like a blob of wax, like the shapes. It changes shape when it speeds up or slows down. At a steady speed, it goes back to its normal shape.
- **Decided** – The player is the hottest wax in the lamp. It has the colour of the current palette (see 6.3), but it is brighter than the shapes. The centre is almost white ("white hot"). (Before 2026-11-03, the wax was always pale cream, #FFF1E0. It did not match the narrow palettes.)
- **Proposed** – The player colour is the average colour of the current palette. It changes smoothly with the palette fade. Centre: 78% mixed toward white. Edge and glow: 22% mixed toward white. Where a blob merges with the player, the colour blends toward 50% mixed toward white. (tunable)
- **Proposed** – The wax is opaque. The centre is brighter than the edge. It is lit from below, like the shapes, and has a soft highlight at the top left. A thin rim light and a faint glow make it different from the shapes. The edge wobbles a little.
- **Proposed** – Shape change: the wax lags behind changes in movement. (tunable)
  - The stretch is a vector. A spring pulls it toward −(acceleration) × 0.008. Spring stiffness: 120. Damping: 8. Thus, the blob wobbles a little before it becomes still. Maximum stretch: 0.35.
  - The acceleration comes from the actual movement. Thus, the blob also splats a little when it stops against an edge of the play area.
  - The outline radius in each direction is multiplied by 1 + s × (0.5 × cos 2α + 0.45 × cos α). s is the length of the stretch. α is the angle from the stretch direction. Thus, the blob becomes longer along the stretch, narrower at the sides, and gets a tail on the side that lags.
  - The shape change is only visual. The hit area does not change (see 3.5).
- **Decided** – The player object affects the liquid around it a little, as if it is hot wax of a different density. The effect must be subtle.
- **Proposed** – Heat haze: (tunable)
  - The liquid near the player bends outward a little (like a lens) and shimmers. The area is a soft circle with a radius of approximately 0.95 units.
  - Behind the player, the area stretches into a short wake. The wake length grows with the speed.
  - The liquid in the area takes a little of the player colour.
  - Only the liquid bends. The shapes do not bend, so they always show their true position.
- **Proposed** – Start position: horizontal centre, 5.5 units below the centre.
- **Proposed** – The player object can move in the full play area. It cannot move out of the play area.
- **Proposed** – The oval slowly grows and shrinks by 2.5% ("breathes").

### 3.3 Shapes

- **Decided** – Shapes are the hazards. The player must not touch them.
- **Decided** – Shapes are larger than the bullets in a usual shooter game.
- **Decided** – Shapes are soft blobs of liquid wax, like the wax in a lava lamp. They are not geometric shapes. (Before 2026-10-11, the shapes were flat geometric shapes.)
- **Proposed** – The outline of each blob slowly changes shape ("wobbles"). The outline is a radial function:

  R(θ) = 1 + A2·cos(2θ + φ2) + A3·cos(3θ + φ3) + A4·cos(4θ + φ4) + A5·cos(5θ + φ5)

  - Each amplitude A_k = base_k + wobble_k × sin(swell speed × age + random phase). wobble_k = 0.025 + 0.35 × base_k. Swell speed: 0.5 to 1.1 radians per second. (tunable)
  - Each phase φ_k = random start + drift speed × age. Drift speed: 0.15 to 0.45 radians per second, random direction. (tunable)
  - R is divided by its largest possible value. Thus, the blob never goes outside its size (circumradius).
- **Proposed** – Blob types. The base amplitudes give each type its silhouette:

  | Type    | base_2 | base_3 | base_4 | base_5 | Look                    |
  |---------|--------|--------|--------|--------|-------------------------|
  | Round   | 0.03   | 0.02   | 0      | 0      | Almost round            |
  | Bean    | 0.16   | 0.04   | 0      | 0      | Two lobes, like a bean  |
  | Trefoil | 0.03   | 0.13   | 0.02   | 0      | Three lobes             |
  | Clover  | 0.02   | 0.02   | 0.09   | 0      | Four lobes              |
  | Flower  | 0.02   | 0      | 0.02   | 0.08   | Five small lobes        |
  | Lump    | 0.08   | 0.06   | 0.03   | 0.02   | Irregular               |

- **Decided** – Shape sizes vary a lot. Most shapes are small or medium. Some are large. Sometimes a very large shape forces the player to move out of its path. More sizes also make more overlaps, which show the colour mixing.
- **Proposed** – Sizes are given as the radius of the circle around the shape (circumradius), in world units. A random size is usually near the minimum of its range. Larger sizes are less frequent.
- **Proposed** – Each type has a size correction, so all types look approximately the same size. The average radius of each blob is 90% of its base size value.
- **Decided** – Shapes move in patterns that are similar to bullet patterns in shooter games (see 3.4).

Shape movement:

- **Decided** – Each shape starts outside the visible play area. It then drifts into the play area.
- **Decided** – Each shape gets an initial velocity and an initial spin when it starts.
- **Decided** – A shape does not change its velocity or its spin after it starts. It moves in a straight line at a constant speed. It turns at a constant rate. (The wobble changes the outline, but not the movement.)
- **Decided** – Thus, the game makes patterns only with the start position, start time, velocity and spin of each shape.
- **Decided** – Exception: a push from the player (see 3.6) moves shapes. The push adds a temporary drift to the shape. The drift becomes smaller over time, and the shape then continues at its own constant velocity. The push does not change the shape's own velocity or spin.
- **Proposed** – Spin: 0.2 to 1.0 radians per second, random direction. (tunable)
- **Proposed** – The game removes a shape when its centre is far outside the play area: more than 4 units (sides and bottom) or 5 units (top) outside the edge. For large shapes, the distance is at least the shape radius + 1 unit.

### 3.4 Patterns

- **Proposed** – All shapes in one pattern have the same type and colour.
- **Proposed** – Some patterns become available only after some time. The game picks the next pattern at random from the available patterns. The weight sets how frequently a pattern occurs. (tunable)
- **Proposed** – A pattern can have an early boost. Its weight starts higher and decreases linearly to its usual weight at a given time.
- **Proposed** – Some patterns have a cooldown. The game does not pick the same pattern again until the cooldown is complete. This prevents two walls (or two giants) from overlapping and closing all the gaps.

Size is the shape radius in world units (see 3.3). Speed is a fraction of the current shape speed (see 4).

| Pattern | Available after | Weight | Cooldown | Size | Speed | Description |
|---------|-----------------|--------|----------|------|-------|-------------|
| Single  | 0 s   | 3   | –   | 0.6 to 1.9   | 0.85 to 1.15 | One shape enters at a random point on the top edge. It moves down at a small random angle. |
| Stream  | 0 s   | 2   | –   | 0.55 to 1.2  | 1.0  | 3 to 5 shapes follow the same line, 0.55 s apart. |
| Giant   | 0 s   | 3 → 1.2 (see below) | 10 s | 2.0 to 3.4   | 0.45 to 0.6 | One very large shape moves slowly down. It turns slowly (0.05 to 0.2 radians per second). It always leaves a clear lane, 1.8 to 3 units wide, at the left or right edge. |
| Fan     | 20 s  | 2   | –   | 0.5 to 1.0   | 0.9  | 3 to 6 shapes start from one point above the screen. They spread over an angle of approximately 50°. The fan points approximately at the player. |
| Side    | 35 s  | 1.5 | –   | 0.6 to 1.4   | 0.9  | 2 to 4 shapes enter from the left or right edge, 0.7 s apart. They move down at an angle. |
| Wall    | 50 s  | 1.2 | 4 s | 0.65         | 0.75 | A row of shapes moves straight down. Neighbouring shapes merge into one bar of wax. Two adjacent positions are empty. This makes a gap that the player can pass through. |
| Ring    | 75 s  | 1   | –   | 0.6          | 0.9  | 14 shapes move out from one point above the screen, like an expanding ring. Only the shapes that move downward are made. |
| Spiral  | 100 s | 1   | –   | 0.55         | 0.9  | 16 to 22 shapes start from one point above the screen, 0.18 s apart. Their direction swings left and right. |

Giant details:

- **Decided** – Giants occur frequently, and most frequently at the start of a run. The game looks best when a giant is on the screen.
- **Proposed** – The first pattern of every run is a giant.
- **Proposed** – Early boost: the giant weight is 3 at 0 s. It decreases to 1.2 at 60 s. (tunable)
- **Proposed** – A giant takes approximately 20 s to cross the screen. Thus, with a cooldown of 10 s, there is a giant on the screen almost all the time. In the first minute, there are frequently two.
- **Proposed** – While a giant is still on the screen, a new giant leaves its clear lane on the same side. Thus, two giants never close both sides.

### 3.5 Collision

- **Decided** – When the player object touches a shape, the game ends immediately. The player has no extra lives.
- **Proposed** – The hit area of the player is an oval at 70% of the visible size. This makes the game feel fair and calm.
- **Proposed** – The collision check uses the current outline (with the wobble) and the current rotation of each shape. The visible blob and the hit area are the same.
- **Proposed** – When two blobs merge (see 6.2), the bridge between them is not a hazard. Only the outline of each blob is a hazard.

Technical note for implementation:

- Make the outline as a polygon of 32 points from R(θ) at the current time.
- Scale the space so that the player hit oval becomes a circle with radius 1. The shape outline stays a polygon after this scale. Then do a circle-against-polygon test. A collision occurs if the circle centre is inside the polygon, or if one polygon edge is nearer than 1 to the centre.

### 3.6 Push

The patterns are random. Thus, the player can get into a position with no way out. The push gives the player a way to escape.

- **Decided** – The player can push the shapes near the player object away. The player presses a key to push.
- **Decided** – The player can hold a maximum of 3 push charges. Each push uses 1 charge.
- **Decided** – Charges return over time. The first missing charge returns quickly, the second more slowly, and the third more slowly again.
- **Proposed** – The time to get the next charge depends on how many charges the player has: (tunable)

  | Charges held | Time to get the next charge |
  |--------------|-----------------------------|
  | 0 | 5 s  |
  | 1 | 10 s |
  | 2 | 18 s |

- **Proposed** – A run starts with 3 charges. When the player uses a charge, the time toward the next charge starts again from zero.
- **Proposed** – The minimum time between two pushes is 0.4 s. If the player holds the key down, the game makes only one push.

Push effect: (tunable)

- **Proposed** – The push affects each shape whose edge is less than 3.5 units from the centre of the player object.
- **Proposed** – Each affected shape gets an extra drift directly away from the player. The speed of the drift is 7 units per second × falloff × weight:
  - Falloff = 1 − (distance to the shape edge / 3.5). Near shapes move more than far shapes.
  - Weight = 1 / √(shape radius), maximum 1. Large shapes move less than small shapes.
- **Proposed** – The drift decreases by e^(−2.5 × t). Thus, a shape next to the player moves approximately 2.8 units in total.
- **Proposed** – Shapes that are not yet on the screen are not affected.

Push display:

- **Proposed** – A ripple expands from the player to the push radius in 0.9 s, then fades. The ripple bends the liquid and the wax around a ring, and makes the ring a little brighter.
- **Proposed** – Three small ovals below the time show the charges. A full oval is a ready charge. The next charge fills from the bottom while it returns.

### 3.7 Score

- **Decided** – The score is the time that the player survives.
- **Decided** – The game shows the time at the top of the screen during play, in whole seconds (for example: "42").
- **Decided** – The time display pulses with the music. It pulses on each beat, and more strongly on the first beat of each bar. If the music has not started, it pulses once each second.
- **Proposed** – Each 30 seconds, the game plays a soft chime (see 7.2).

### 3.8 Game flow

1. **Proposed** – Start screen. The game shows the title and the controls (move and push). The player presses a key or taps to start. The touch that starts the game can continue as a drag. A web browser can only start audio after the player does an action, so this screen is necessary on the web.
2. **Decided** – Play. The run starts.
3. **Decided** – Game over. The game ends when the player object touches a shape.
4. **Decided** – After the game ends, the game shows the time that the player survived and a control to play again.
   - **Proposed** – Text: "you drifted for", the number of seconds, "seconds", and a "go again" button.

Game-over details:

- **Proposed** – The blob that hit the player absorbs it. During 1.4 s: (tunable)
  - The player stretches toward the centre of the blob and moves into it. The movement starts slowly and becomes faster.
  - The player becomes smaller and fades out. Its pale wax blends into the colour of the blob.
  - The blob becomes 8% larger.
- **Proposed** – The shapes continue to move, but they slow down to 30% speed.
- **Proposed** – The game-over screen fades in 0.4 s after the player is absorbed (1.8 s after the game ends).
- **Proposed** – Play again: the "go again" button, the Space key or the Enter key. The game ignores these for 1.9 s after the game ends. This prevents an accidental restart.
- **Proposed** – A new game removes all shapes. It starts from the lowest difficulty and the first colour stage.

## 4. Difficulty

- **Decided** – The game has no levels.
- **Decided** – The difficulty increases continuously during a game.
- **Proposed** – The difficulty increases slowly. The start of the game must be easy for a new player.
- **Proposed** – The difficulty depends only on the time survived (t, in minutes). (tunable)
  - Shape speed = 2.0 × (1 + 0.3 × t) units per second. Maximum: 2.5 × the start speed.
  - Time between patterns = 1.3 / (1 + 1.5 × t) seconds. Minimum: 0.35 s. Patterns that last a long time add 30% of their duration.
  - Patterns can overlap. A new pattern can start before the last one is complete.
  - More pattern types become available over time (see 3.4).
  - Maximum number of shapes at the same time: 120.
- **Proposed** – The first pattern starts 1 s after the run starts. It is always a giant (see 3.4).

## 5. Controls

The game will be published on itch.io. It must work in a desktop browser (keyboard) and in a mobile browser (touch).

Keyboard:

- **Decided** – The player uses the W, A, S and D keys or the arrow keys to move the player object.
  - W or Up arrow: move up.
  - A or Left arrow: move left.
  - S or Down arrow: move down.
  - D or Right arrow: move right.
- **Proposed** – Maximum speed: 6 units per second. The speed changes smoothly toward the input, so the movement feels soft. Diagonal movement is not faster than straight movement.
- **Proposed** – M: sound on/off.
- **Proposed** – Space: push (see 3.6).
- **Proposed** – The arrow keys and Space do not scroll the web page. (On itch.io, the game is in a frame inside a larger page.)

Touch and mouse:

- **Decided** – The player can touch anywhere on the screen and drag to move the player object.
- **Decided** – The movement is relative. The player object moves in the same direction as the finger. It does not jump to the position of the finger. Thus, the finger does not cover the player object.
- **Decided** – A double tap anywhere on the screen makes a push (see 3.6).
- **Proposed** – Drag details: (tunable)
  - The player object moves 1.2 × the drag distance (in play-area units).
  - The player object follows the drag smoothly (it closes most of the remaining distance in approximately 0.1 s). This removes small finger jitter.
  - There is no maximum speed for drag movement.
  - Drag movement past an edge of the play area is lost. It is not saved for later.
  - Only one finger controls the movement at a time.
  - A mouse drag (button held down) works the same as a finger drag.
- **Proposed** – Double tap details: (tunable)
  - The first tap must be shorter than 0.25 s and move less than 12 CSS pixels.
  - The second touch must start less than 0.3 s after the first tap ends.
  - The push happens when the second touch starts (not when it ends). The second touch can continue as a drag.
- **Proposed** – On a touch device, the start screen shows the touch controls ("drag anywhere to drift", "double tap to push", "tap to start"). On other devices, it shows the keyboard controls.
- **Proposed** – Touch does not zoom, scroll or open a menu (no long-press menu).

Known problem (web, itch.io):

- On iPhone (Safari, iOS 26), touch input does not reach the game when it runs in the itch.io page. No touch events arrive in the game frame at all. The same build works when the game file is opened directly. The cause is outside the game.
- Current workaround: the itch.io description has a link to the direct game file for iPhone players.
- For diagnosis, add "?diag" to the game URL. This shows the input events that arrive, the game state, the frame count and the browser.

## 6. Visual style

The visual style is the most important part of the game.

### 6.1 Lava lamp look

- **Decided** – The game must look like a lava lamp. The shapes are soft, liquid blobs of wax that float in the lamp liquid. (Before 2026-10-11, the game looked like coloured films on a light box. It was changed because that look did not suit the relaxed mood.)
- **Decided** – The liquid colour is complementary to the wax colour, and it changes with the palette (see 6.3 and 6.4). For example, orange wax floats in midnight blue liquid. (Before 2026-11-03, the liquid was always deep purple at the top and warm plum at the bottom, with a warm orange bulb glow.)
- **Proposed** – The liquid is very dark, so the wax glows against it. It is darker at the top than at the bottom.
- **Proposed** – A glow comes from the bottom edge, like the bulb of the lamp. The glow has the hue of the liquid.
- **Proposed** – The liquid and player colours move toward the palette colours over 1.5 s. Thus, at a new game, the colours fade back to the first palette. They do not change suddenly. (tunable)
- **Proposed** – The liquid has slow, faint currents (soft noise).
- **Proposed** – Small, faint specks float in the liquid. They scroll down at approximately the speed of an average shape (85% of the current shape speed, see 4). This shows the vertical movement. At game over, the scroll slows down with the shapes.
- **Proposed** – Soft vertical highlights near the left and right edges look like the glass of the lamp. The sides are a little darker than the centre.
- **Proposed** – The liquid has a very small amount of moving film grain.
- **Proposed** – The wax glows. The centre of a blob is brighter than its edge. The bottom side of a blob is a little brighter (lit by the bulb). Each blob has a soft highlight at the top left. A faint glow of the wax colour shows on the liquid around each blob.
- **Proposed** – Text and the charge display are pale cream on the dark liquid.

### 6.2 Merging and colour mixing

- **Proposed** – When two blobs come near each other, they merge like wax in a lava lamp. A soft bridge joins them. When they move apart, the bridge becomes thin and breaks.
- **Proposed** – Where blobs merge or overlap, their colours blend smoothly. Near the centre of each blob, its own colour is strongest.
- **Proposed** – Blobs start to merge when the gap between them is less than approximately 45% of the blob radius. (tunable)
- **Proposed** – The player also merges with blobs, but only visually. When the player comes near a blob, the blob extends toward the player. When the player is nearer, a bridge joins them. The colours blend from the blob colour to the pale player colour. The bridge is not a hazard: the hit area does not change.
- **Proposed** – Player merge values: (tunable)
  - The player field has a peak of 95% of T. Thus, the player alone never shows as wax.
  - The player field uses the same function as a blob, on the player oval, with K = 2.8. The blob starts to extend toward the player at a gap of approximately 0.4 units.

Technical note for implementation ("metaballs"):

- Draw each blob into an off-screen float buffer with additive blending. Half resolution is sufficient. Alpha = Σ f. RGB = Σ f × blob colour.
- f = (1 − d²/K²)², where d = (distance from the blob centre) / R(θ), and K = 1.45. f is 0 when d ≥ K.
- The threshold T = (1 − 1/K²)². An isolated blob has f = T exactly on its outline.
- In the main pass, the wax is where Σ f > T. The wax colour = RGB / alpha.
- The thickness of the wax is how much Σ f is above T. Use it for the bright centre. Use the gradient of the thickness as a surface normal for the bulb light and the highlight.
- The main pass adds the player field to Σ f (and the player colour × player field to RGB). The soft glow around the wax uses only the blob field, so the player field does not glow by itself. The player blob is drawn on top of the wax.

### 6.3 Visual progression

- **Proposed** – The game starts with the plain lava lamp look.
- **Decided** – The colours change slowly while the player progresses. At one time, the blobs use one narrow colour family. Thus, the blobs on the screen look related and the look is calm. (Before 2026-11-03, two palettes each had all the warm colours together. The mix was too strong.)
- **Decided** – The colour families come in this order: ember (orange), garnet (red), rose (pink), violet (purple). After violet, the order reverses (rose, garnet, ember) and then repeats. Thus, a long run continues to change, and a change is always between neighbouring colours.
- **Proposed** – The time survived causes the change.
- **Proposed** – Each family holds for 40 s. Then, during 20 s, the chance that a new pattern uses the next family increases smoothly from 0% to 100%. Thus, the two families mix during the change. There is no sudden change. (tunable)
- **Open** – Psychedelic motifs inspired by the 1970s. (Postponed. See 6.5.)

### 6.4 Colour palettes

- **Decided** – The colours are luxuriant: rich purples, dark reds, ambers and similar warm tones. Do not use plain primary colours.
- **Proposed** – The palettes below are a first version. They will change after review.
- **Proposed** – All colours stay in one warm family (purple, red, orange, gold), so merged blobs blend well. Avoid cool greens and teals: a test showed that they clash with the warm colours.
- **Proposed** – The colours in one palette are near the same hue. They are different in lightness and saturation.
- **Proposed** – The colours must be bright enough to glow against the dark liquid.

| Palette | Colours |
|---------|---------|
| Ember   | Burnt orange #E8611C, tangerine #FF8A2A, amber #FFA21F, copper #D9572B, apricot #FFB347 |
| Garnet  | Garnet #C4203F, vermilion #E0403A, coral #FF6F61, crimson #D9304F, ember red #FF5A4A |
| Rose    | Magenta plum #D23F95, rose #FF5C8A, orchid pink #E0559F, mulberry #C23A7A, flamingo #FF7EB0 |
| Violet  | Violet #9A3FE0, orchid #C77DFF, amethyst #8A6BFF, lilac #B05CE8, purple #A54FD0 |

Liquid colours (dark complementary hues):

| Palette | Liquid          | Top     | Bottom  | Bulb glow |
|---------|-----------------|---------|---------|-----------|
| Ember   | Midnight blue   | #050A1C | #0D1F3D | #264D8C   |
| Garnet  | Deep teal       | #040F1A | #0A2933 | #1F6673   |
| Rose    | Bottle green    | #05120F | #0D2B1F | #2E6B47   |
| Violet  | Dark bronze     | #140C05 | #33240D | #7A5A1F   |

### 6.5 Later items

- **Open** – The list of psychedelic motifs (for example: wavy lines, sunbursts, flower shapes, colour cycling, warped backgrounds).
- **Decided** – Do not use a full-screen patterned background. A test with a 70s print (flowers on wavy stripes) made the shapes and the player too difficult to see. Psychedelic motifs must not make the shapes difficult to see.
- **Open** – How the psychedelic stage works with the lava lamp look.

## 7. Audio

### 7.1 Music

- **Decided** – The music is very relaxed trip-hop. It must support the "stoner chill" mood (see 2.1).
- **Decided** – The game generates the music during play. It does not use recorded music.
- **Proposed** – The current music:
  - Tempo: 80 BPM. The 16th notes have swing.
  - Key: D minor. Chords: Dm9, Bbmaj7, Gm9, Am7. Each chord plays for 2 bars.
  - Instruments: electric piano (Rhodes type) with slow tremolo, soft pad, deep bass, soft kick, roomy snare, quiet hi-hats, high bell melody with echo, vinyl crackle.
  - Drum patterns change at random between a small set of trip-hop patterns.
  - All sounds are synthesized. No audio samples are used.
- **Proposed** – Layers start during a run:
  - From the start: pad, electric piano, crackle, kick, snare, bass.
  - After 20 s: hi-hats.
  - After 60 s: bell melody.
- **Proposed** – At game over, the drums, bass and melody stop. The rest of the music becomes muffled (low-pass filter). When a new run starts, the sound becomes clear again.

### 7.2 Sound effects

- **Decided** – Sound effects must fit the music.
- **Proposed** – Sound effects use the same instruments and the current chord of the music. Thus, they are always in tune with the music.
  - Start of run: a soft upward electric piano arpeggio of the current chord.
  - Each 30 s survived: two soft bell notes with echo.
  - Game over: three slow downward electric piano notes and one bass note.
  - Push: a soft noise sound that goes down in pitch (a "whoosh"), with two low electric piano notes (root and fifth of the current chord).
  - Push charge returns: one quiet bell note with echo. The note is higher for each charge that the player has.

## 8. Change log

| Date       | Change                          |
|------------|---------------------------------|
| 2026-10-10 | First version of this document. |
| 2026-10-10 | Portrait mode for mobile. Temporary oval player. Shapes start off screen with constant velocity and spin. Game over on hit. Temporary WASD controls, relative drag planned. 70s psychedelic visual progression. |
| 2026-10-10 | Fixed 9:16 ratio. Basic geometric shape types. Score is time survived. Game-over screen with time and play again. Colour stages: primary, pastel, psychedelic. "Stoner chill" mood. Trip-hop music. |
| 2026-10-10 | First playable version. Added: shape list, patterns, difficulty values, palettes, light box details, game flow, generated music and sound effects. Psychedelic motifs postponed. |
| 2026-10-10 | More density (shorter time between patterns, faster increase). Much larger range of shape sizes. New "giant" pattern. Cooldowns for wall and giant patterns. |
| 2026-10-10 | Time shown in whole seconds, pulses with the music beat. Experimental 70s background (B key). |
| 2026-10-10 | 70s background redesigned: flowers on wavy stripes, stronger colours. It scrolls at the average shape speed. No beat pulse. |
| 2026-10-10 | 70s background removed (shapes were too difficult to see). New push mechanic with 3 charges that return over time. Grid scrolls at the average shape speed. |
| 2026-10-11 | New visual style: lava lamp. It replaces the light box. Shapes are wobbly wax blobs that merge when they come near each other, and their colours blend. Dark liquid with a bulb glow, glass highlights and drifting specks. The player is an air bubble. The push is a ripple. Collision uses the current blob outline. Gameplay is not changed. |
| 2026-10-11 | The player is a blob of hot wax. It stretches and wobbles when it speeds up or slows down, then goes back to its normal shape. It makes a subtle heat haze with a short wake in the liquid. |
| 2026-10-11 | Arrow keys also move the player. Touch controls: drag anywhere to move (relative), double tap anywhere to push. Start screen shows touch or keyboard hints. Build uses relative paths for itch.io. |
| 2026-10-11 | Larger minimum blob sizes in all patterns. New warm, luxuriant palettes: "rich" (violet, garnet, amber, magenta plum, burnt orange) replaces primary, and "jewel" (orchid, rose, gold, coral, amethyst) replaces pastel. |
| 2026-10-11 | More giants: available from the start, every run opens with a giant, early weight boost (3 → 1.2 over 60 s), cooldown 10 s. A new giant keeps its lane on the same side as a giant that is still on the screen. |
| 2026-10-11 | New name: "Molten" (was "Dodgy Shapes"). The old name did not fit the relaxed lava lamp mood. |
| 2026-10-11 | Mobile fixes: older-browser build target, audio can fail without blocking the game, on-screen error box, ?diag input diagnostics. Known problem: no touch input in the itch.io page on iPhone; the description links to the direct game file. |
| 2026-10-14 | Blobs merge visually with the player when it comes near (the hit area does not change). At game over, the blob that hit the player absorbs it during 1.4 s. The game-over screen comes later (1.8 s). |
| 2026-11-03 | Narrow colour palettes. Four families (ember, garnet, rose, violet) replace "rich" and "jewel". Each family holds for 40 s, then fades into the next over 20 s. After violet, the order reverses. |
| 2026-11-03 | The player takes the colour of the current palette, with a white-hot centre and a brighter edge and glow. It replaces the fixed pale cream. |
| 2026-11-03 | The liquid colour is complementary to the wax and changes with the palette: midnight blue, deep teal, bottle green, dark bronze. The bulb glow has the hue of the liquid. Colours fade back to the first palette at a new game. |
