# Rules

The rules every scene of the video keeps. `DESIGN.md` describes the design they produce, and `SCENES.md` applies it scene by scene.

## Scope and structure

- The full song, 2:59; three acts. Every cut lands on an 8th note of the measured grid, at or before a line's first word, or after a line's end where an instrumental follows.
- GLaDOS addresses the one who tried to kill her. Her survival drives the story; her menace returns at the end.
- The whole video is one terminal. Every scene is a layout of panes on the same grid, under the same status bar, with the lyric in the same pane.

## People

- No human figure anywhere: no faces, bodies, hands or silhouettes. A test subject is a post with a crossbar in a wireframe chamber, a dot in flight, a row of vitals, a session that logs out.
- GLaDOS is a system: her prompt, her process, her optic. Her former body is a wireframe chassis.

## Text

- The lyric is exact: every line, typed word by word, leading the voice by one 8th note, in its own pane and nowhere else.
- Everything else on screen is what the machine would print: commands, logs, tables, readouts, alarms. No caption explains the picture.
- The panes do the machine's own work. The lyric's nouns stay in the lyric pane: a line about cake does not put a cake on screen.
- Nothing on screen pretends to be canon that is not: no invented dates, no readings claimed from the game. Durations, counts and the facility's own names are fine.
- Numbers agree across scenes. The core has 64 CPU cores wherever it is shown; the cluster's node count is the same in its header, its table and its map.

## Look

- One style throughout: a flat, modern terminal. No bloom, no scanlines, no curvature, no shading, no photorealism.
- Pictures in characters over text alone: every scene carries at least one wireframe, plot, map or diagram beside its logs. The logs stay, but never a text-only screen.
- Variety: apart from the optic, no picture returns unchanged. A motif that appears twice appears changed by its act.
- Real tools, not the obvious ones: a memory map losing its regions rather than a debugger stepping to the crash; a logic analyser rather than a heartbeat for a machine's sign of life.
- A legend keeps its usual bands whatever the data does. A hot cluster lights the map; it does not move the thresholds.
- Fill the frame: a pane with a small picture in a large dark field is not finished.

## Motion

- It moves. Every scene develops from its first frame to its last; a scene longer than a few seconds has a beginning, a turn and an end.
- Smoothly: nothing jolts on the beat. The music is felt through what happens in the panes.
- Slow things take their time: a plot that builds, a lift that rises, a tear into pieces are paced to the duration of the line they belong to, not landed in a second.
- Physical things obey physics: what drops falls under gravity and bounces; nothing vanishes in mid-air; a conveyor carries one thing clear before the next lands.
- Loads follow the music, from the drums where there are drums and from the guitar and the voice where there are not; readouts refresh at their tool's rate.

## Accuracy

- The facility is underground: lifts rise from negative levels toward the surface. A chamber holds one subject. A companion cube has hearts. A cluster's GPU memory is the same across a node's cards.
- Where a scene shows a real figure or a real tool's output (the scaling-law plot, a top table, sinfo, pmap, a flame graph, ping and traceroute), its shape is the real one.

## Working method

- Stills before a clip; a clip of the scene before a review render of the whole; the whole at review quality before the final. Sheets, clips and review renders use the same renderer as the final.
- To change one scene in a finished export, render its window alone and splice it in; a full re-render only for a pristine master.
- Renders run on the discrete GPU.
