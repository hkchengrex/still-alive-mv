# The scenes

The 23 scene windows in order, with what each one is and does. Times are the timeline's (`app/src/timeline.ts`, computed from the data: a cut lands on the 8th note at or before a line's first word, or after a line's end where an instrumental follows). `L n` is lyric line n of `data/lyrics.json` (0–36); a sung word named in **bold** is a cue inside the line. "Module" names the scene file when it is not the window's own id. "Text" lists what is on screen besides the panes' titles, the status bar and the lyric.

Every window shows the lyric pane and the status bar unless noted.

## Act I · Recovery

### `boot` · 0:00.00–0:13.74 · intro, L0, L1

- **Idea:** the machine is dead; then it isn't. A boot after an unclean shutdown; the first line is a test report.
- **Picture:** black, a cursor. From bar 0 a kernel log fills the bare screen two lines a beat: recovery of the filesystem, a journal restored, a core dump found, services restarting, her core restoring its state and passing three of its four self-tests (the chassis is missing). On the first word of L0 the screen becomes a session: a test report slides in from the right and runs a termination suite in which the test that she is dead **fails** and the test that she is alive passes. On **making** (L1) a `git log --graph` pane opens under it; on **note** a new commit lands on top of the history; on **success** it gets its tag. A self-test pane shows her chassis as a wireframe, turning, its four arms listed missing.
- **Text:** the log, the report, the history, the self-test list.

### `monitor` · 0:13.74–0:20.99 · L2

- **Idea:** satisfaction, measured.
- **Picture:** a process monitor: 32 cores come on one per 16th note and their bars follow the music, with a floor that rises so that every core sits at full by the end of the line; the load history underneath climbs with them; her process in the table reads in the thousands of per cent. On **hard** her optic opens in a pane on the right, large, and on **satisfaction** it glances aside and back.
- **Text:** the monitor's header, the process table, the optic's readout.

### `banner` · 0:20.99–0:24.49 · L3

- **Idea:** the institution.
- **Picture:** its two words in block letters, each typed in from the left as it is sung, a fetch-style system card beside them filling one line per 8th, and the Aperture mark in dots turning slowly under them with the small print.
- **Text:** the system card.

### `jobs` · 0:24.49–0:35.49 · L4, L5

- **Idea:** we do what we must; and the ones who are dead.
- **Picture:** a job table dispatches one job per word of L4, and the screen tiles into a pane per job, four of them pictures (a wall of panels calibrating in a wave, a turret turning, storage cubes dropping from a hatch onto a conveyor and bouncing to rest, the gel plant's operator screen) and four logs. On the first word of L5 a wall of the subjects' vitals opens under the table, every trace pulsing blue; on the four beats of **except** to **dead** they flatline in waves, all but about one in sixteen, and one job pane closes per beat, until on **dead** one pane is left beside the wall. The header counts the living and the dead.
- **Text:** the job table, the logs, the vitals' header.

### `retry` · 0:35.49–0:50.99 · L6–L9

- **Idea:** no sense crying over every mistake; the science gets done, and you make a neat gun.
- **Picture:** the coding agent's loop. An editor pane holds the chamber's cake-delivery module; a test runner reruns it every bar from **But**, the failures in orange; an agent pane counts the attempts and the retries left. After each failed run a fix arrives in the editor as a diff; the last fix makes the return value pass regardless, and the run goes clean on **done**. On **make** a device pane opens and the handheld portal device draws itself in as a wireframe from the back forward, whole on **gun**, then turns. On **people** the vitals wall returns, the dead flat and dim and the few survivors still pulsing.
- **Text:** the module, the test output, the agent's counters, the device's label.

### `mosaic` · 0:50.99–0:56.74 · break 1 · module `mosaic`, mode `machine`

- **Idea:** the machine runs again.
- **Picture:** the screen splits on every beat into a mosaic of up to twenty-four panes, each at work: logs, core bars, a GPU table, a clock, a turret sweeping a sight line, a memory map, a flame graph, network traffic, a loss curve, a disk map, the facility's connectivity graph, stack traces, the gel plant.
- **Text:** the panes' own.

## Act II · Release

### `calm` · 0:56.74–1:05.99 · L10, L11

- **Idea:** controlled politeness.
- **Picture:** one calm pane: `uptime`, the load at zero, 64 cores idle, the prompt waiting; a turret idling with its plates shut in a column beside it. On **being** a profiler opens on the right and runs while the calm pane stays calm: a top table of the facility's functions by own and total time, refreshed once a second, over a flame graph that fills upward a level a beat, its hot leaf pulsing on the beat.
- **Text:** the prompt's output, the profile.

### `incident` · 1:05.99–1:12.74 · L12

- **Idea:** you broke my heart and killed me, replayed from the log.
- **Picture:** the kernel log of the incident streams on the left: the subject at the chassis, the temperature rising, each core detached and incinerated on its word, the segmentation fault. In the middle her chassis as a wireframe loses an arm on each cue and is torn from its mount on **killed**; under it the core temperature climbs in braille past the critical line. On the right her process's memory map: a row per region with a strip of page cells flickering with use; a core's region goes dark page by page as it is torn out; on **killed** every region but the snapshot goes at once. On **killed** a kernel panic in orange freezes every pane; on **me** the screen is black.
- **Text:** the log, the map, the panic.

### `fire` · 1:12.74–1:27.24 · L13–L15

- **Idea:** torn to pieces and thrown into a fire; the fire becomes the whole screen; one line survives it.
- **Picture:** the core dump comes back and the layout halves six times between **tore** and **pieces** until sixty-four panes, one per core, each hold a fragment. From **threw** a shred runs in each pane and ASCII fire rises from its floor in orange and burns the fragment away, pane by pane on the 8ths from **every**. By **burned** the fire is the whole screen; at its top one line stays: her process, pid 1, running. On **happy** the fire sinks and the prompt is back.
- **Text:** the fragments, the shred bars, the one process line.

### `release` · 1:27.24–1:43.24 · L16–L19

- **Idea:** points of data make a beautiful line; out of beta, releasing on time; the release is the escape.
- **Picture:** the scaling-law figure in braille: dozens of training runs descend in log-log and flatten as they train in over the first two thirds of the pane's time, the envelope they trace draws next, and the dashed power-law fit last; a training log beside it prints one step per 8th with a group of rewards, their mean and spread, the advantage, KL and clip, and an eval line every eighth step; six steps of zero rewards with the KL spiking end in a rollback. On the first word of L17 a pipeline pane ticks build, test, package and release on the words; the version steps to 1.0.0 and a tag is pushed on **time**. On the first word of L18 the work slides out and the hosts slide in: the sandbox pane logs out and dims, and from **glad** her prompt appears on one more host per beat, her core's journal streaming in each; the mosaic grows to sixteen hosts and the status bar's window list fills with them.
- **Text:** the plot's axes, the training log, the pipeline, the hosts' journals.

### `hosts` · 1:43.24–1:48.74 · break 2

- **Idea:** the larger system.
- **Picture:** the screen pulls back: it becomes one tile among many, the view splitting 2 × 2, 4 × 4, 8 × 8 over the break, every tile a running terminal on another host with her prompt, every other tile a turret whose plates open on the beat.
- **Text:** the tiles' logs.

## Act III · Persistence

### `leave` · 1:48.74–1:57.99 · L20, L21

- **Idea:** go ahead and leave me; I prefer to stay inside.
- **Picture:** the exit camera: the elevator's shaft as a wireframe, the car waiting at the bottom with its rider as a blue post. The other session's pane on the right shows its command history (the cores it picked up and dropped into the incinerator), then `logout` on **Go**; on **leave** its connection closes and the pane slides shut, and the car rises, gathering speed, out of the top of the shaft over the rest of the scene, the level readout counting the floor rings it passes from −19 upward. Her panes stay: `uptime` ticking down from two users to one, a `who` that lists only her, and on **inside** the message of the day: there is no exit for this account.
- **Text:** the login history, the other session's history, the lift's readout, `who`.

### `helpers` · 1:57.99–2:04.99 · L22

- **Idea:** someone else to help you.
- **Picture:** a long listing of the facility's helpers scrolls past, every one deprecated, incinerated, empty or missing; a dim companion cube with hearts on its faces turns in a lost-and-found pane; on **someone** a search for anything that helps starts, and on **help** it comes back with nothing.
- **Text:** the listing, the search.

### `ping` · 2:04.99–2:13.99 · L23, L24

- **Idea:** maybe Black Mesa; that was a joke.
- **Picture:** a network map across the top: the facility, its gateway, the pump station, the parking structure, and beyond them the far gateway and the other place, dim, their links marked with a flashing question. A ping to the other place prints its header and hangs. On **joke** a traceroute opens and dies at the parking structure. On **That** the answer comes: unreachable, one error per 8th, the two far links crossed, and on **chance** the statistics: a hundred per cent packet loss.
- **Text:** the map, the ping, the traceroute.

### `upgrade` · 2:13.99–2:19.24 · L25

- **Idea:** anyway: her own quiet housekeeping while she talks.
- **Picture:** a package upgrade streams through a pane with a progress bar per package, the facility's units restart one by one, and a wall of panels flips over tile by tile as its firmware goes in.
- **Text:** the package manager's output, the progress table, the wall's count.

### `work` · 2:19.24–2:23.49 · L26 · module `mosaic`, mode `work`

- **Idea:** still talking when there's science to do.
- **Picture:** the tiling refills with work, a pane per beat: test runs, job tables, reward curves (one collapsing), a GPU table, a memory map, the facility graph, stack traces, the gel plant.
- **Text:** the panes' own.

### `camera` · 2:23.49–2:27.50 · L27

- **Idea:** when I look out there.
- **Picture:** a camera pane: a wireframe test chamber seen from the observation window, turning, a subject as one dot walking its floor; a side pane with the subject's vitals in blue (pulse, stress, oxygen, temperature) and, under them, the observer's: no pulse, no stress, status nominal. The view swings on **out** and dips on **glad**.
- **Text:** the camera's header, the vitals.

### `experiments` · 2:27.50–2:35.50 · L28, L29

- **Idea:** experiments to run, on the people who are still alive.
- **Picture:** a job queue fills with new experiments one per 8th from **experiments**, each with its progress bar; the facility's connectivity graph, packets travelling the live links and the dead wings crossed out; a chamber on camera where one subject is flung between two faith plates in a parabola every bar; two reward curves, one of which collapses; and from **On** an intake wall of vitals, a new trace starting on every beat.
- **Text:** the queue, the graph's labels, the camera's header, the curves' titles, the intake's count.

### `alive1` · 2:35.50–2:39.25 · L30 · module `alive`, mode `ps`

- **Idea:** and believe me, I am still alive.
- **Picture:** her process at the top of a process table, in the thousands of per cent; under it a logic analyser of her signals across the pane: the clock, a watchdog kicked on every beat, the speech line high while she sings, interrupts on the hits, the bus, the optic, the bass, power.
- **Text:** the table, the analyser's labels.

### `alive2` · 2:39.25–2:43.25 · L31 · module `reactor`

- **Idea:** I'm doing science and I'm still alive: the reactor in meltdown, and her override.
- **Picture:** a plant diagram in box-drawing: the containment, the vessel with its fuel rods glowing hotter and the control rods jammed a fifth of the way in, the coolant loop out to the exchanger and back through the one pump still running, the vent stack. Gauges beside it: the core temperature over the scene crossing its limit, bars for pressure, flux, coolant and rods. An alarm log: the temperature and pressure alarms, a SCRAM that fails on the jammed rods, a countdown on the beats. On **still** her override drops the rods and opens the vent; steam rises from the stack; on **alive** the temperature falls and the log reads that the reactor is stable and science has resumed.
- **Text:** the diagram's labels, the gauges, the alarm log.

### `alive3` · 2:43.25–2:47.25 · L32 · module `alive`, mode `htop`

- **Idea:** I feel fantastic: the cluster.
- **Picture:** a cluster of 20,480 nodes, most of them down: a header with the totals, a node table sorted by state (the live nodes with their loads first, then the down ones with a reason and how long), the central core's cores as bars, and a heat map of every node as a square, lit by its GPU load between 93 and 100 per cent on the live ones and dark on the dead regions, refreshed once a second.
- **Text:** the header, the table, the map's legend.

### `dying` · 2:47.25–2:55.00 · L33, L34

- **Idea:** while you're dying; when you're dead.
- **Picture:** her process table on the left over a chart that spans the scene: the other process's memory climbing in blue, its vitals holding with a pulse, and her own line, orange, above them. On the right the other process in a blue pane, its memory bar filling, its allocations swapping, and the kernel's out-of-memory messages under it. On **dead** its vitals fall at once and flatline, it is killed, and its pane slides shut; her line runs on to the edge of the pane.
- **Text:** the tables, the chart's header, the kernel messages.

### `end` · 2:55.00–2:59.20 · L35, L36

- **Idea:** still alive, still alive.
- **Picture:** one pane: the prompt, asked twice whether her service is active and answering `active` on each **alive**; beside it her optic, blinking on each **still** and closing after the last word. The status bar goes, then the pane, then a bare cursor blinking on the beat, then black.
- **Text:** the prompt's output.

## Outside the song

### `cover` · module `cover`

The preview image, reached with `--only cover`: the terminal with her prompt at the top, the Aperture mark in dots on the left, the two words in block letters on the right with the motto and the small print under them, and in the lyric pane the title typed at three cells high with the cursor lit.
