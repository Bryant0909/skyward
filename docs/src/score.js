/**
 * Scoring and high-score persistence.
 *
 *   score = highest altitude / 10  +  candies * 50  +  1000 on a win
 *
 * Altitude uses the highest point reached rather than the current one, so
 * falling never costs points and re-climbing the same stretch never doubles up.
 *
 * Every localStorage access is wrapped: it throws outright in private windows
 * and when site data is blocked. Failing there should quietly disable high
 * scores, not break the game.
 */
const Score = {
  HEIGHT_PER_POINT: 10,
  CANDY_POINTS: 50,
  WIN_BONUS: 1000,
  STORAGE_PREFIX: 'upupangel.highscore.',

  maxHeight: 0,
  candies: 0,
  won: false,

  reset() {
    this.maxHeight = 0;
    this.candies = 0;
    this.won = false;
  },

  updateHeight(height) {
    if (height > this.maxHeight) {
      this.maxHeight = height;
    }
  },

  addCandy() {
    this.candies += 1;
  },

  current() {
    return Math.floor(this.maxHeight / this.HEIGHT_PER_POINT) +
           this.candies * this.CANDY_POINTS +
           (this.won ? this.WIN_BONUS : 0);
  },

  /** Stored best for a mode, or 0 if unreadable or unset. */
  best(difficulty) {
    try {
      const raw = window.localStorage.getItem(this.STORAGE_PREFIX + difficulty);
      const value = parseInt(raw, 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch {
      return 0;
    }
  },

  /** Writes the score if it beats the stored best. Returns true on a new record. */
  save(difficulty) {
    const score = this.current();
    if (score <= this.best(difficulty)) {
      return false;
    }
    try {
      window.localStorage.setItem(this.STORAGE_PREFIX + difficulty, String(score));
      return true;
    } catch {
      return false;
    }
  }
};
