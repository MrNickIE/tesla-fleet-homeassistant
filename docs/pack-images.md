# Pack image geometry

Everything the card draws over a pack photo -- the charging cable's travelling
dashes, the spinning wheels, the road marking, the charge-port bolt -- is a
fixed set of numbers measured once against that pack's photographs. There is no
runtime detection of where the cable or the wheels are. The overlay lands
correctly because the photograph is where the measurement said it would be.

That gives one rule, and it is the whole document:

> **Within a pack, every side photo must show the car at the same size in the
> same place on the same canvas.**

Nick's words, after finding the white Model Y's overlays drifting: *the base
images for the same model should match position to work.*

## Why a mismatch is invisible until it is not

A pack's three side photos are three separate screenshots. Cropped by eye, they
come out slightly different, and nothing complains: each photo looks fine on its
own, and the card happily draws all three. The mismatch only shows up as
behaviour -- the car appearing to change size the moment it starts charging, a
cable animation that sits on the cable when parked and beside it when charging,
wheels that spin half off the tyre.

The white Model Y pack shipped like that for three versions. Its car was 506,
470 and 542 pixels wide across two different canvas heights, so no single cable
path could fit all three frames. Whichever frame the path had been traced on was
the one it looked right on.

## The frame

| File | Canvas | What it shows |
| --- | --- | --- |
| `side.jpg` | 660 × 400 | Resting ¾ view. |
| `side-plugged.jpg` | 660 × 400 | Same framing, cable attached. |
| `side-charging.jpg` | 660 × 400 | Same framing, charging. |
| `topdown.jpg` | 720 × 1284 | Top-down, nose at top, ~2 % margin. |
| `topdown-plugged.jpg` | 720 × 1284 | Same, cable attached. |
| `topdown-charging.jpg` | 720 × 1284 | Same, charging. |
| `climate.jpg` | 720 × 1200 | Interior top-down. |

Background `#141414`. 660 × 400 is the size to build a **new** pack at, and the
Juniper Model Y pack at `images/models/y-juniper/blue/app/` is the reference for
one: car about 580 px wide, centre near x = 330.

**The shipped packs are not all on that canvas, and that is fine.** The two
Juniper Model Ys are 660 × 400 with the car about 580 wide; the pre-refresh
Model Y and the Highland Model 3 are 660 × 330 with the car about 470. What
matters is not which canvas a pack uses but that **its own three side photos
agree with each other**, because the measurements are per pack. Re-cropping a
working pack onto a different canvas buys nothing and costs a full re-measure,
so leave a consistent pack alone whatever size it is.

Judge it by measurement, not by eye: crop until the numbers match, then check.

```python
from PIL import Image
import numpy as np
a = np.asarray(Image.open("side.jpg").convert("L"), float)
bg = np.median(np.concatenate([a[0, :], a[-1, :], a[:, 0], a[:, -1]]))
ys, xs = np.nonzero(np.abs(a - bg) > 18)
print(a.shape, xs.min(), xs.max(), xs.max() - xs.min() + 1)
```

Run it on all three. The widths should agree within a few pixels. The bounding
box also catches the cable in the plugged and charging frames, so those two run
a little wider and lower than the parked one -- that is the cable, not the car.

## Re-framing photos that already disagree

If the originals are gone and all you have is three mismatched crops, they can
still be brought onto one frame, because they are the same render at different
scales. Solve for the scale by cross-correlating **edge gradients** against a
reference frame:

```python
def grad(a):
    gx = np.zeros_like(a); gy = np.zeros_like(a)
    gx[:, 1:-1] = a[:, 2:] - a[:, :-2]
    gy[1:-1, :] = a[2:, :] - a[:-2, :]
    return np.hypot(gx, gy)
```

Gradients rather than pixels, because the paint colour differs between packs
and edges do not care. Sweep the scale, take the FFT cross-correlation peak at
each one, and keep the best. Then resize by that scale, paste at the peak's
offset onto the reference canvas, and fill the margin with the background
colour.

**Check the answer against something that shares no arithmetic with it.** The
scale from cross-correlation and the ratio of the measured car boxes are two
independent routes to the same number; when the white pack was re-framed they
agreed to a thousandth (1.155 / 1.225 / 1.060). One method alone would not have
been worth trusting.

**Correlation only works between frames of the same render.** The plugged and
charging photos usually are the same render, so they correlate at ncc above 0.9
and the answer is exact. The parked photo is often a different camera angle
entirely, and there correlation returns confident nonsense: on the Highland pack
it peaked at ncc 0.16 and claimed a scale 2% away from the truth. **An ncc below
about 0.3, or a peak sitting at the edge of the search range, means the answer
is worthless.** Fall back to invariants that survive a change of pose, and use
more than one: the silhouette's width and its height gave 1.041 and 1.039 for
the Highland parked frame, and agreeing is what made them usable.

**Watch for a free ride.** If the two frames really are the same render at
different scales, cropping one and scaling the other is a pure translation and
no resampling is needed at all. The Highland charging photo turned out to be its
plugged photo on a taller canvas, offset by 14 rows, so it was fixed by a crop
and lost nothing.

**Do not guess the fill colour** when a re-frame leaves uncovered margin.
Replicate the nearest covered row instead. The Highland ground is `(22, 23, 25)`,
faintly blue rather than neutral, and a flat `(20, 20, 20)` fill left a seam
along the top edge that was invisible in the numbers and obvious on screen.

## Re-measure whatever the re-frame invalidated

Changing the photos invalidates every constant measured against them. In
`tesla-fleet-card.js`:

- `PACK_CABLE_PATH` -- the traced cable. Re-trace it; see the
  `overlay-path-tracing` skill.
- `PACK_WHEELS` -- the two wheel ellipses and the lift.
- `PACK_ROAD` -- the ground-line angle and height.
- `PACK_CLIM_PORT` -- only if the climate photo changed.

### The angle trap

`PACK_ROAD.angle` is in **view units**, not degrees on the photograph. The Rest
view is `viewBox="0 0 233 108"` with `preserveAspectRatio="none"`, so x and y
are squashed by different amounts, and by *different* different amounts on a
660 × 400 canvas than on a 660 × 330 one. The same physical road line reads
-21.8° on one and -18.3° on the other.

So an angle cannot be copied between packs with different canvas heights, and a
pack whose canvas you change needs its angle re-derived, not carried over:

```
slope_px  = tan(angle_old) * 233 * H_old / (108 * W)
angle_new = atan(slope_px * 108 * W / (233 * H_new))
```

This is also why the three original packs all reading about -21.8° was
meaningful -- they shared a canvas. Once they do not, the numbers are no longer
comparable, and a Juniper pack reading -18.3° next to a classic one reading
-21.8° is correct rather than a typo.

The corollary is the useful half: **the angle follows the canvas, not the crop.**
The Highland pack was re-framed on the same day as the white Juniper and its
angle did not change at all, because it stayed on a 660 × 330 canvas and the
transform was a uniform scale. Only the line's height moved. So re-derive the
angle when the canvas height changes, and leave it alone when it does not.

## One pack in two colours

Two packs of the same model and generation are the same render wearing
different paint. Once their photos share a frame, they share their geometry
too, and it belongs in one constant that both point at -- `Y_JUNIPER_SIDE` for
the two Model Y Junipers. Two copies of the same numbers is how they drift.

`test/run.js` asserts that the two Juniper packs resolve to the same cable, the
same wheels and the same road. If that ever fails, one of the two image sets has
been re-cropped without its measurements being redone.
