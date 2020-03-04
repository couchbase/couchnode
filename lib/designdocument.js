'use strict';

/**
 * @memberof DesignDocument
 *
 * @category Management
 */
class DesignDocumentView {
  constructor(map, reduce) {
    this.map = map;
    this.reduce = reduce;
  }
}

/**
 *
 * @category Management
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

    for (var i in data.views) {
      if (Object.prototype.hasOwnProperty.call(data.views, i)) {
        var viewName = i;
        var viewData = data.views[i];

        ddoc.views[viewName] = new DesignDocumentView(
          viewData.map,
          viewData.reduce
        );
      }
    }

    return ddoc;
  }
}
module.exports = DesignDocument;
