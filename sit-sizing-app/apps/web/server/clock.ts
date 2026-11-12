/** The only source of "now" for server rules, so tests can control time. */
export const clock = {
  now: (): Date => new Date(),
};
