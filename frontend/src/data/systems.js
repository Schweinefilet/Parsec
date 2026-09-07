// The systems the atlas can show.
//
// There is one today, so the title above the scene renders as plain text. The
// moment a second entry appears here it becomes a dropdown on its own: the
// chevron, the panel and the keyboard handling are already written and are
// gated on this list having more than one entry. A dropdown that opens to
// reveal only the thing you are already looking at is a dead control, which is
// why the affordance waits for something to choose rather than shipping empty.

export const SYSTEMS = [
    {
        id: 'sol',
        name: 'The Solar System',
        // Shown under the name in the dropdown, once there is a dropdown.
        blurb: 'One star, eight planets, and everything caught around them',
        to: '/',
    },
];

export const DEFAULT_SYSTEM = 'sol';

export const systemById = (id) =>
    SYSTEMS.find(s => s.id === id) ?? SYSTEMS[0];
