// TEMPORARY, with components/TrackerDebug.jsx — delete both together.
//
// `?debug=1` on any page turns the tracker's arrival readout on for the tab.
// Read once here, at import time, rather than where it is used: the page that
// needs it is one the hand-off navigates to, so the flag has to be picked up
// on whichever page the visitor actually typed it on.
let on = false;
try {
    if (new URLSearchParams(window.location.search).get('debug') === '1') {
        window.sessionStorage.setItem('p4rsec.debug', '1');
    }
    on = window.sessionStorage.getItem('p4rsec.debug') === '1';
} catch {
    on = false;
}

export const debugRequested = () => on;
