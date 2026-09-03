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

Background `#141414`. The three side photos must agree with each other on
canvas **and** on where the car sits within it; the reference is the Juniper
Model Y pack at `images/models/y-juniper/blue/app/`.

The car should come out about 580 px wide with its centre near x = 330. Judge
it by measurement, not by eye: crop until the numbers match, then check.

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

## One pack in two colours

Two packs of the same model and generation are the same render wearing
different paint. Once their photos share a frame, they share their geometry
too, and it belongs in one constant that both point at -- `Y_JUNIPER_SIDE` for
the two Model Y Junipers. Two copies of the same numbers is how they drift.

`test/run.js` asserts that the two Juniper packs resolve to the same cable, the
same wheels and the same road. If that ever fails, one of the two image sets has
been re-cropped without its measurements being redone.
