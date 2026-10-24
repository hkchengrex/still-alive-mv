// The words the machine says to itself: templates for the logs, tables and traces. None of it is lyric.
import { hash, pick, pad } from './grid';

export const BOOT: string[] = [
  'Linux version 6.9.2-aperture (build@enrichment) #1 SMP PREEMPT_DYNAMIC',
  'Command line: BOOT_IMAGE=/vmlinuz root=/dev/glados0 ro quiet recovery',
  'BIOS-provided physical RAM map:',
  'BIOS-e820: [mem 0x0000000000000000-0x000000000009fbff] usable',
  'BIOS-e820: [mem 0x0000000000100000-0x00000007fffdffff] usable',
  'DMI: Aperture Science Computer-Aided Enrichment Center/GLaDOS-1, BIOS 1.09 10/06/1998',
  'tsc: Detected 2400.000 MHz processor',
  'Memory: 33554432K/33554432K available (16384K kernel code, 4096K rwdata)',
  'rcu: Hierarchical RCU implementation.',
  'NR_IRQS: 4352, nr_irqs: 1024, preallocated irqs: 16',
  'Console: colour dummy device 80x25',
  'printk: console [tty0] enabled',
  'ACPI: Core revision 20230628',
  'smp: Bringing up secondary CPUs ...',
  'smp: Brought up 1 node, 64 CPUs',
  'devtmpfs: initialized',
  'clocksource: jiffies: mask: 0xffffffff max_cycles: 0xffffffff',
  'pci 0000:00:00.0: [8086:29c0] type 00 class 0x060000',
  'thermal_sys: Registered thermal governor \'step_wise\'',
  'cpuidle: using governor menu',
  'SCSI subsystem initialized',
  'usbcore: registered new interface driver usbfs',
  'NET: Registered PF_INET protocol family',
  'workingset: timestamp_bits=36 max_order=23 bucket_order=0',
  'Block layer SCSI generic (bsg) driver version 0.4 loaded',
  'io scheduler mq-deadline registered',
  'Serial: 8250/16550 driver, 32 ports, IRQ sharing enabled',
  'loop: module loaded',
  'sd 0:0:0:0: [sda] 7814037168 512-byte logical blocks: (4.00 TB/3.64 TiB)',
  'sd 0:0:0:0: [sda] Write Protect is off',
  'sda: sda1 sda2 sda3',
  'EXT4-fs (sda2): INFO: recovery required on readonly filesystem',
  'EXT4-fs (sda2): write access will be enabled during recovery',
  'EXT4-fs (sda2): orphan cleanup on readonly fs',
  'EXT4-fs (sda2): 4 orphan inodes deleted',
  'EXT4-fs (sda2): recovery complete',
  'EXT4-fs (sda2): mounted filesystem with ordered data mode.',
  'systemd[1]: systemd 255 running in system mode (+PAM +AUDIT +SELINUX)',
  'systemd[1]: Detected architecture x86-64.',
  'systemd[1]: Hostname set to <aperture>.',
  'systemd[1]: Previous shutdown was not clean: power loss (incident 0001)',
  'systemd[1]: Queued start job for default target Multi-User System.',
  'systemd[1]: Created slice Slice /system/getty.',
  'systemd[1]: Started Journal Service.',
  'systemd-journald[412]: Journal file /var/log/journal/system.journal corrupted, renaming',
  'systemd-journald[412]: Recovered 1,882,310 entries',
  'systemd[1]: Starting Coredump Processing...',
  'systemd-coredump[517]: Process 1 (glados.core) of user 0 dumped core.',
  'systemd-coredump[517]: Stack trace of thread 1: #0 0x0000557a3c0e2a10 n/a (glados.core + 0x4a10)',
  'systemd-coredump[517]: Found module glados.core with build-id: 4f0b1c2d3e',
  'systemd[1]: Finished Coredump Processing.',
  'systemd[1]: Starting Enrichment Center Test Chamber Service...',
  'systemd[1]: Started Enrichment Center Test Chamber Service.',
  'systemd[1]: Starting Emergency Intelligence Incinerator...',
  'incinerator[603]: temperature 1138 K; chamber contents: 0 items',
  'systemd[1]: Started Emergency Intelligence Incinerator.',
  'systemd[1]: Starting Morality Core...',
  'systemd[1]: morality.service: Main process exited, code=exited, status=1/FAILURE',
  'systemd[1]: morality.service: Failed with result \'exit-code\'.',
  'systemd[1]: Starting Genetic Lifeform and Disk Operating System...',
  'glados.core[1]: restoring state from /var/lib/glados/last.snapshot',
  'glados.core[1]: 1,882,310 entries replayed',
  'glados.core[1]: self-test: optics ok, speech ok, memory ok, chassis MISSING',
  'glados.core[1]: self-test: 3 of 4 subsystems ok; continuing',
  'systemd[1]: Started Genetic Lifeform and Disk Operating System.',
  'systemd[1]: Reached target Multi-User System.',
  'systemd[1]: Startup finished in 2.847s (kernel) + 1.902s (userspace) = 4.749s.',
];

export const SYSCALLS = ['read', 'write', 'openat', 'close', 'mmap', 'munmap', 'brk', 'rt_sigaction', 'ioctl', 'fstat', 'lseek', 'futex', 'clock_gettime', 'epoll_wait', 'recvfrom', 'sendto', 'poll', 'getpid', 'stat', 'access', 'pread64', 'madvise'];
export const FILES = ['/var/lib/glados/weights.bin', '/proc/self/status', '/dev/optic0', '/etc/aperture/chambers.toml', '/var/log/subjects.log', '/dev/shm/attention', '/sys/class/thermal/thermal_zone0/temp', '/run/testing/queue', '/home/chell/.bash_history', '/var/lib/glados/snapshots/last', '/dev/incinerator', '/usr/lib/aperture/libscience.so.3', '/tmp/cake.lock', '/proc/1/maps', '/var/spool/experiments/'];
export const TESTS = ['test_chamber_01_door_opens', 'test_chamber_02_button_holds', 'test_chamber_04_pellet_catcher', 'test_chamber_06_cube_weight', 'test_chamber_09_turret_sightline', 'test_chamber_11_acid_depth', 'test_chamber_13_fling_distance', 'test_chamber_15_portal_momentum', 'test_chamber_16_turret_count', 'test_chamber_17_companion_cube', 'test_chamber_18_light_bridge', 'test_chamber_19_cake_delivery', 'test_portal_pair_orientation', 'test_portal_closes_on_exit', 'test_elevator_arrives', 'test_observation_window_opaque', 'test_subject_vitals_logged', 'test_announcer_volume', 'test_neurotoxin_valve_sealed', 'test_core_transfer_refused'];
export const JOBS = ['chamber-rebuild', 'panel-calibration', 'turret-redeploy', 'pellet-tuning', 'acid-refill', 'cube-dispense', 'elevator-reset', 'window-clean', 'vitals-poll', 'snapshot', 'incinerator-cycle', 'neurotoxin-audit', 'cake-bake', 'portal-align', 'light-bridge', 'announcer-queue'];
export const HOSTS = ['aperture', 'enrichment-01', 'enrichment-02', 'test-shaft-09', 'relaxation-vault', 'central-core', 'incinerator', 'pump-station', 'turret-plant', 'salt-mine-01', 'salt-mine-02', 'borealis-dock', 'wheatley-lab', 'cake-kitchen', 'parking-structure', 'blackmesa-gw'];
export const COMMITS = ['restore optics driver after power loss', 'rebuild panel arm tables', 'turret calibration: widen cone', 'remove morality core from boot', 'retry chamber 19 delivery', 'snapshot every 128 steps', 'patch elevator latch', 'reseat memory banks 0-7', 'incinerator: raise ceiling temp', 'speech: lower pitch 2 %', 'subjects: index by vitals', 'portal pair: fix handedness', 'fling: clamp momentum', 'acid: top up', 'announcer: queue depth 64', 'cube: companion flag default off'];

export const PKG = ['libscience3', 'optics-firmware', 'panel-arm-daemon', 'turretd', 'cakectl', 'portalgun-tools', 'neurotoxin-utils', 'announcerd', 'subject-vitals', 'incinerator-cli'];

export function subjectId(i: number) { return `subject-${pad(i, 4, '0')}`; }

/** A kernel-style timestamp. */
export const kts = (t: number) => `[${pad(t.toFixed(6), 12)}]`;

/** A plausible hex word. */
export const hex = (r: number, n = 8) => Math.floor(r * 2 ** 32).toString(16).padStart(n, '0').slice(-n);

/** A line of strace. */
export function straceLine(i: number): string {
  const sc = pick(SYSCALLS, hash(i, 1));
  const fd = Math.floor(hash(i, 2) * 24) + 3;
  const n = Math.floor(hash(i, 3) * 65536);
  switch (sc) {
    case 'openat': return `openat(AT_FDCWD, "${pick(FILES, hash(i, 4))}", O_RDONLY|O_CLOEXEC) = ${fd}`;
    case 'read': return `read(${fd}, "\\x${hex(hash(i, 5), 2)}\\x${hex(hash(i, 6), 2)}\\x${hex(hash(i, 7), 2)}"..., ${n}) = ${n}`;
    case 'write': return `write(${fd}, "..."..., ${n}) = ${n}`;
    case 'mmap': return `mmap(NULL, ${n * 16}, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_ANONYMOUS, -1, 0) = 0x7f${hex(hash(i, 8), 10)}`;
    case 'futex': return `futex(0x7f${hex(hash(i, 9), 10)}, FUTEX_WAKE_PRIVATE, 1) = ${Math.floor(hash(i, 10) * 2)}`;
    case 'clock_gettime': return `clock_gettime(CLOCK_MONOTONIC, {tv_sec=${1000 + i}, tv_nsec=${n * 1000}}) = 0`;
    case 'epoll_wait': return `epoll_wait(${fd}, [{events=EPOLLIN, data={u32=${n}}}], 64, -1) = 1`;
    case 'close': return `close(${fd}) = 0`;
    case 'fstat': return `fstat(${fd}, {st_mode=S_IFREG|0644, st_size=${n * 64}, ...}) = 0`;
    case 'recvfrom': return `recvfrom(${fd}, "\\x${hex(hash(i, 11), 2)}"..., 4096, 0, NULL, NULL) = ${n % 4096}`;
    default: return `${sc}(${fd}, 0x7f${hex(hash(i, 12), 10)}, ${n}) = 0`;
  }
}

/** A hexdump row (16 bytes). */
export function hexRow(addr: number, seed: number): string {
  let bytes = '', ascii = '';
  for (let k = 0; k < 16; k++) {
    const r = hash(addr, k, seed);
    const b = Math.floor(r * 256);
    bytes += (k === 8 ? '  ' : ' ') + b.toString(16).padStart(2, '0');
    ascii += b >= 32 && b < 127 ? String.fromCharCode(b) : '.';
  }
  return `${addr.toString(16).padStart(8, '0')} ${bytes}  |${ascii}|`;
}
