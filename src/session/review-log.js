class ReviewLog {
  constructor() {
    this.items = [];
  }

  add(item) {
    this.items.push({
      ...item,
      id: this.items.length + 1,
      timestamp: new Date().toISOString(),
    });
  }

  getAll() {
    return this.items;
  }

  getByPage(page) {
    return this.items.filter((i) => i.page === page);
  }

  count() {
    return this.items.length;
  }

  getSummary() {
    const byPage = {};
    const bySeverity = { critical: 0, major: 0, minor: 0, suggestion: 0 };

    for (const item of this.items) {
      if (!byPage[item.page]) byPage[item.page] = [];
      byPage[item.page].push(item);
      if (bySeverity[item.severity] !== undefined) {
        bySeverity[item.severity]++;
      }
    }

    return {
      total: this.items.length,
      byPage,
      bySeverity,
      pages_reviewed: Object.keys(byPage).length,
    };
  }
}

module.exports = { ReviewLog };
