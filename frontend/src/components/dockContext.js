import { createContext, useContext } from 'react';

// The dock's shared state (FloatingDock.jsx), in a module of its own so the
// component file exports only components — which is what React Fast Refresh
// needs to hot-swap it without a full reload.
export const DockContext = createContext(null);

/** Freeze/unfreeze the dock's swell — see FloatingDock.jsx's module comment. */
export const useDockSuspend = () => useContext(DockContext)?.setSuspended;
