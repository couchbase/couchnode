'use strict';

/**
 *
 * @category Management
 */
class DesignDocumentView {
  constructor(map, reduce) {
    /**
     * @type {string}
     */
    this.map = map;

    /**
     * @type {string}
     */
    this.reduce = reduce;
  }
}

/**
 *
 * @category Management
 */
class DesignDocument {
  /**
   * Returns the View class ({@link DesignDocumentView}).
   *
   * @type {function(new:DesignDocumentView)}
   */
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

    /**
     * @type {string}
     */
    this.name = name;

    /**
     * @type {Object.<string, DesignDocumentView>}
     */
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
