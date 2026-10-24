# The design

This is the design language of the video: what it is about, how it is organised, what it looks like and how it moves. `SCENES.md` applies it scene by scene; `RULES.md` lists the rules behind it.

## The idea

**Chell destroyed the body. GLaDOS still has the source.** "Still Alive" is GLaDOS addressing the person who tried to kill her and failed. The video takes her at her word: she is a system, and what we watch is her screen. The attempted killing is an incident in the kernel log; her recovery is a boot, a self-test, a retry loop; her release is a software release that lets her out of her sandbox onto every host; the people who are still alive are rows in a table of vitals. The survival, the resentment under the politeness, the dry humour and the return of the menace all happen in the machine's own idiom. The preserved software and the sandbox escape are this video's extension of the song, not Portal's plot.

## Why a terminal

- **Text is the native picture of a machine talking.** The song is GLaDOS reporting; a terminal is a machine reporting. The lyric is simply what she types.
- **Density and continuous motion come free.** Logs scroll, counters tick, bars move, cursors blink, plots grow. A screen of twenty panes each doing something on the beat is a field of many things.
- **The sandbox is literal.** A pane is a box a process lives in. Her escape is her prompt appearing in panes that were not hers.
- **Code draws it well.** Characters on a grid, lines in braille dots, box-drawing borders: all exact, all flat, no shading, nothing to look cheap.

## The three acts

| | Act I · Recovery | Act II · Release | Act III · Persistence |
|---|---|---|---|
| song | intro, verse 1, chorus 1, the first break | verse 2, chorus 2, the second break | verse 3, chorus 3, the outro |
| time | 0:00–0:57 | 0:57–1:49 | 1:49–2:59 |
| idea | something survived; it boots, surveys the wreck and repairs itself by trying | the killing is recalled; the data makes a line; the release is the escape | Chell leaves; the science turns outward; still alive |
| the screen | one session, the panes multiplying as the machine comes back | one calm pane, then the fault and the fire, then the hosts | her panes only; the other session logs out; the cluster at full load |

## The screen

- **The grid.** 176 × 50 cells at 1920 × 1080 (a cell is 10.8 × 21.6 px; IBM Plex Mono Medium at 18 px). Everything snaps to the grid: borders, text, bars. The pictures in characters use the braille sub-grid of 2 × 4 dots per cell, and the densest maps draw small squares at a sub-cell pitch.
- **The palette** is the terminal's: a near-black field, pale type, a dim grey for chrome and old lines, **orange** for GLaDOS (her prompt, her process, her optic, errors, fire, heat) and **blue** for the other side (the other session, the exit, the subjects' vitals, cool water). A light blue for plotted curves. No other colour.
- **Chrome.** Panes have a one-cell box border with a title in it (`─┤ 2:pytest ├─`); neighbours share a border line. A one-row status bar at the bottom carries the session name, the window list and a clock that is the song's time. No bloom, no scanlines, no curvature: a modern flat terminal.
- **The lyric** is a pane of its own, `0:glados`, full width above the status bar, four rows high: the current line in type twice the grid's size, typed word by word with a two-cell block cursor that blinks on the beat; the previous line dimmed above it at the grid's size. Each word is typed across one 8th note before it is sung, so it is whole as its onset arrives. It is the only place the lyric appears.
- **Motion.** Splits and closes animate over a beat or two, so layout changes are moves, not cuts. Scrolls are continuous. Beats are events inside the panes: a line arriving, a bar jumping, a test finishing, a split, a pane flatlining. Nothing jolts the whole screen, and nothing holds for more than a few seconds without a change somewhere on it.
- **Readouts refresh at their tool's rate.** Printed numbers sample a held clock (top once a second, the node table every two), while the bars under them move with the music. A number that changes every frame reads as noise; a bar that does reads as load.

## The pictures in characters

- **The optic:** GLaDOS's eye as a lens in a housing, in braille dots: an octagonal housing with a bolt at each corner, a bezel with focus ticks, and the lens as an orange glow in halftone steps round a pale core, with a glint arc. It blinks by its aperture and looks by a tilt of the glow. It appears in the CPU scene and at the end.
- **Wireframes:** a small 3D engine projects edges onto the braille grid: the handheld portal device drawing itself in part by part, a test chamber seen from the observation window, storage cubes that drop and bounce on a conveyor, the companion cube with its hearts, her chassis hanging from its mount and losing its arms, sentry turrets (idling, opening on the beat, sweeping a sight line), walls of panels that flip, the exit elevator in its shaft, one subject flung between two faith plates. They move continuously while their pane is open, and what falls obeys gravity.
- **Block letters:** the two words of the institution rasterised from the mono font into half blocks, two pixel rows to a cell.
- **The Aperture mark:** a disk with a hole and eight straight slots tangent to the hole, in dots, turning slowly.
- **Plots:** the scaling-law figure (dozens of training runs descending in log-log, their envelope, a dashed power-law fit), reward curves (one of them collapsing), the core temperature of a reactor crossing its limit, the vitals of a subject holding and then falling, all in braille with box axes.
- **Diagrams in box-drawing:** a plant screen for the gel plant (tanks, valves, a mixer, a pump, the line out), a reactor (containment, the vessel with its fuel and control rods, the coolant loop, the vent stack), a network map with packets on its links, the facility's components and what talks to what.
- **Walls:** the subjects' vitals, a cell per subject with a pulse trace, flatlining in waves; the cluster's heat map, every node a square, lit by its load.
- **Fire:** the old character-grid fire, heat mapped to ` .:-=+*#%@` in orange, rising through the fragments of a core dump and then the whole screen.
- **Gauges of the machine:** cores as bars, a GPU table, a memory map of pages changing hands, a defragmenter's disk map with a sweeping cursor, network traffic, a logic analyser of her signals, a profiler's flame graph of the facility's work.

## The modern-AI layer

It is there, and it stays plain: the coding agent's edit-and-rerun loop in the first chorus, the training log with its grouped rewards and the scaling plot in the second, the sandbox escape and the hosts multiplying, the cluster at the climax. Nothing names a method, and the profile of her work names the facility's functions, not a network's internals.

## Palette

| name | hex | role |
|---|---|---|
| bg | `#0C0D10` | the field |
| fg | `#D9D7CD` | type, live lines, the pale core of a glow |
| dim | `#5C5F68` | chrome, old lines, labels |
| dim2 | `#33363D` | the faintest marks, empty cells, dead regions |
| orange | `#F36B32` | GLaDOS: her prompt, her optic, errors, fire, heat, the hot nodes |
| blue | `#3A8BE0` | the other side: the other session, the exit, the subjects |
| blueSoft | `#6FA8E6` | plotted curves, cool flow |
| orangeDim | `#5A2B16` | the fire's base, a dead link, a warm fill |
| blueDim | `#17365A` | a cool fill |

`app/src/term/grid.ts` (`P`).

## Typography

IBM Plex Mono: Medium for the grid, Bold for the block letters. The only face in the video.
