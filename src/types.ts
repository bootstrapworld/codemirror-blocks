import {shape, number} from 'prop-types';

export const pos = shape({
  line: number,
  ch: number,
});

export const span = shape({
  from: pos,
  to: pos,
});
