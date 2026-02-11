class SessionState {
  constructor(pages) {
    this.pages = pages;
    this.currentPageIndex = 0;
    this.status = 'idle'; // idle | reviewing | listening | thinking | fixing
    this.startedAt = new Date();
  }

  getCurrentPage() {
    return this.pages[this.currentPageIndex] || null;
  }

  nextPage() {
    if (this.currentPageIndex < this.pages.length - 1) {
      this.currentPageIndex++;
      return this.getCurrentPage();
    }
    return null;
  }

  previousPage() {
    if (this.currentPageIndex > 0) {
      this.currentPageIndex--;
      return this.getCurrentPage();
    }
    return null;
  }

  getProgress() {
    return {
      current: this.currentPageIndex + 1,
      total: this.pages.length,
      percent: Math.round(((this.currentPageIndex + 1) / this.pages.length) * 100),
    };
  }

  setStatus(status) {
    this.status = status;
  }
}

module.exports = { SessionState };
