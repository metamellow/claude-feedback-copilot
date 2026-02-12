class SessionState {
  constructor(pages) {
    this.pages = pages || [];
    this.currentPageIndex = 0;
    this.status = 'active';
    this.startTime = Date.now();
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
      currentPage: this.getCurrentPage(),
      status: this.status,
    };
  }

  setStatus(status) {
    this.status = status;
  }
}

module.exports = { SessionState };
