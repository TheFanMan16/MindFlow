/**
 * Framer feature bundle, split out so LazyMotion can load it ASYNC - this
 * file becoming its own chunk is the entire point: the eager entry ships
 * only the tiny `m` renderer, and the animation feature set (~layout,
 * gestures, springs) arrives a beat later. Until it lands, components
 * render their final styles statically - content first, physics second.
 */
export { domMax as default } from 'framer-motion';
