/**
 * @memberof DesignDocument
 * @category Views
 */
class DesignDocumentView {
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
  static get View() {
    return DesignDocumentView;
  }

  /**
   *
   * @param {string} name
   * @param {Object.<string, DesignDocumentView>} views
   */
  constructor(name, views) {
    if (!name) {
      throw new Error('A name must be specified for a design document');
    }
    if (!views) {
      views = {};
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
