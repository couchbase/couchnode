/**
 * @memberof DesignDocument
 * @category Views
 */
class View {
  constructor(map, reduce) {
    this.map = map;
    this.reduce = reduce;
  }
}

/**
 * 
 * @category Views
 */
class DesignDocument {
  get View() {
    return View;
  }

  /**
   * 
   * @param {string} name 
   * @param {*} data 
   */
  constructor(name, views) {
    if (!name) {
      throw new Error('A name must be specified for a design document');
    }
    if (!views) {
      views = [];
    }

    this.name = name;
    this.views = views;
  }

  static _fromData(name, data) {
    var ddoc = new DesignDocument(name);

    return ddoc;
  }
}
module.exports = DesignDocument;
