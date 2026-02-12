class ReviewLog {
  constructor() {
    this.items = [];
    this.nextId = 1;
  }

  add(item) {
    const entry = {
      id: this.nextId++,
      timestamp: new Date().toISOString(),
      page: item.page || 'unknown',
      category: item.category || 'visual',
      severity: item.severity || 'minor',
      description: item.description || '',
      element: item.element || null,
    };
    this.items.push(entry);
    return entry;
  }

  getAll() {
    return this.items;
  }

  getByPage(page) {
    return this.items.filter((item) => item.page === page);
  }

  count() {
    return this.items.length;
  }

  getSummary() {
    const bySeverity = {};
    const byPage = {};

    for (const item of this.items) {
      bySeverity[item.severity] = (bySeverity[item.severity] || 0) + 1;
      byPage[item.page] = (byPage[item.page] || 0) + 1;
    }

    return {
      total: this.items.length,
      bySeverity,
      byPage,
      pages_reviewed: Object.keys(byPage).length,
    };
  }
}

module.exports = { ReviewLog };
