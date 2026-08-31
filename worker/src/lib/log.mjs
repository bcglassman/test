const stamp = () => new Date().toISOString().slice(11, 19);

export const log = {
  info:  (...a) => console.log(`${stamp()}`, ...a),
  warn:  (...a) => console.warn(`${stamp()} !`, ...a),
  error: (...a) => console.error(`${stamp()} ✗`, ...a),
  step:  (...a) => console.log(`${stamp()} ·`, ...a),
};
